# VPN on Ubuntu 18+

Ubuntu switched network management to `systemd-networkd`, but automated VPN connections still need
NetworkManager.  NetworkManager in turn needs to manage an interface and DNS for it to start a VPN
connection and correctly configure name service for its subnet.

The following steps show how to configure VPN in an Ubuntu-20.04 KVM virtual machine. 18.04 and
newer should all be similar; 16.04 still used NetworkManager so should work without changes.

It's also possible to install VPN using OpenVPN, but with manually edited configuration files.

## Install packages

[https://blog.mevi.tech/setting-up-l2tp-vpn-in-ubuntu/](https://blog.mevi.tech/setting-up-l2tp-vpn-in-ubuntu/) <br>
[https://unix.stackexchange.com/questions/703089/how-to-set-a-vpn-connection-in-nmcli](https://unix.stackexchange.com/questions/703089/how-to-set-a-vpn-connection-in-nmcli) <br>
[https://askubuntu.com/questions/1146861/how-to-set-up-l2tp-client-on-ubuntu-18-04](https://askubuntu.com/questions/1146861/how-to-set-up-l2tp-client-on-ubuntu-18-04)

NetworkManager is no longer installed by default, nor are the network connection editor or
its L2TP plugin.

    sudo apt-get install network-manager-gnome          # for nm-connection-editor
    sudo apt-get install network-manager-l2tp           # L2TP plugin for the connection editor
    sudo apt-get install network-manager-l2tp-gnome     # ? unsure why

If this starts the xl2tpd service, turn it off and disable it:

    sudo systemctl status xl2tpd.service
    sudo systemctl stop xl2tpd.service
    sudo systemctl disable xl2tpd.service
    sudo systemctl status xl2tpd.service

## Configure NetworkManager

[https://askubuntu.com/questions/882806/ethernet-device-not-managed](https://askubuntu.com/questions/882806/ethernet-device-not-managed)

NetworkManager needs to manage at least one network device, any device, to be willing to manage
VPN connections.

To configure NetworkManager to manage a network device, edit
`/etc/NetworkManager/NetworkManager.conf` to change `[ifupdown] managed=true`.  For the VM to use
the VPN name server upon connecting, NetworkManager has to know to tell `systemd-resolved`, so add
`dns=systemd-resolved` under `[main]`.  And to not interfere with the bridges when the `lxc`
package is installed, add `[keyfile] unmanaged-device=type:bridge`.

     [main]
     plugins=ifupdown,keyfile
    +dns=systemd-resolved

     [ifupdown]
    -managed=false
    +managed=true
    +
    +[keyfile]
    +unmanaged-devices=type:bridge

Also edit `/etc/netplan/00-installer-config.yaml` to add NetworkManager as the renderer: (this was
a suggested step, but my network was initialized without it, so ymmv)

     network:
    +  renderer: NetworkManager
       ethernets:
         ens3:
            dhcp4: true
       version: 2

**NOTE:** If the Linux Containers package `lxc` is installed its default network might conflict
with the `10.0.0.0/8` subnet used by some VPNs.  Edit `/etc/default/lxc-net` and change the
default `LXC_ADDR=10.0.3.0/24` to a non-conflicting unused subnet; I used `192.168.7.0/24`.
Can then `systemctl restart lxc-net` or can let the reboot below take care of it.

Then reboot the VM, because it's unclear if NetworkManager will run correctly without.  (When I
installed it, it got stuck in a failed state and could not be restarted.  The reboot fixed it.)

After the restart, looking at the connections and devices with `nmcli` should show the wired
network connection as managed; something like

    sudo nmcli conn
    NAME                UUID                                  TYPE      DEVICE
    Wired connection 1  76af3064-c3ae-3618-839b-33282fef6a14  ethernet  ens3

    sudo nmcli dev
    DEVICE  TYPE      STATE      CONNECTION
    ens3    ethernet  connected  Wired connection 1
    lo      loopback  unmanaged  --

## Configure the VPN connections

Now that NetworkManager is running, `nm-connection-editor` will work to configure VPN connections.
Earlier in the setup process it greys out all fields and cannot save.

The connection editor must run as root, and must its graphical user interface must be permitted to
open a window on the client display:

    sudo touch /root/.Xauthority
    sudo xauth mege $HOME/.Xauthority

To allow the remote end of an ssh connection to open X-Windows applications on the local screen,
run ssh with `-Y`, or add `ForwardX11Trusted yes` to the top section of the local user's
`~/.ssh/config` file.

Finally, we can launch the connection editor.  Do not forget to set a connection name, because
the settings are saved to a file  `/etc/NetworkManager/system-connections/[connection-name].nmconnection`
where the initial connection name becomes part of the filename.

    sudo nm-connection-editor

Create new connections with the `+` (plus sign) in the lower-left corner, and choose a connection
type of Layer 2 Tunneling Protocol (L2TP).  The L2TP option will not show up until the
network-manager-l2tp package has been installed.  The connection config files are kept as
`/etc/NetworkManager/system-connections/<connection-name>.nmconnection`.

Fill in the VPN account particulars (you should have received instructions along with the VPN
account credentials.)

On the `IPv4 Settings` tab enter `~.` (a tilde followed a period) under Additional Search Domains.
This will designate this VPN interface as a routing domain, telling `systemd-resolved` to look up
domain names on the VPN interface in parallel with the default ens3 network interface (which is
also a routing domain, and routing domains get preference).

    Additional search domains  [ ~.                   ]

On the `IPv4 Settings : Routes...` subpage tell the connection to route the VPN subnet (eg
`10.0.0.0`), because connecting to the VPN does not automatically add it.  Leave the gateway
empty, NetworkManager will route it to the VPN tunnel (typically `ppp0`).  Use a metric lower than
100 to make the network preferentially use the `10.` VPN interface for `10.` destinations (the
default interface can not handle VPN traffic, it will send but no replies will arrive.)

    Address     Netmask      Gateway   Metric
    10.0.0.0    255.0.0.0              50

**IMPORTANT:** For the connection under `IPV4 Settings` on the bottom-right `Routes...` be sure to
check the option to "use this connection only for resources on its network", else all network
traffic, including replies to the current ssh connection, will be routed to the VPN tunnel, making
the VM inaccessible.

It is also possible to create VPN connections from the command line using just `nmcli`, but the
connection editor is easier.

Once configured, the VPN connection can then be started from the command line by name:

    sudo nmcli conn up id <connection-name>

Once the VPN connection is established, the KVM + VPN routing table should look something like

    $ route -n
    Kernel IP routing table
    Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
    0.0.0.0         192.168.6.1     0.0.0.0         UG    100    0        0 ens3   <-- default traffic
    10.0.0.0        0.0.0.0         255.0.0.0       U     50     0        0 ppp0   <-- VPN traffic onto VPN tunnel
    **.***.**.190   192.168.6.1     255.255.255.255 UGH   100    0        0 ens3   <-- remote VPN end
    192.0.2.1       0.0.0.0         255.255.255.255 UH    50     0        0 ppp0   <-- VPN tunnel interface
    192.168.6.0     0.0.0.0         255.255.255.0   U     100    0        0 ens3   <-- KVM subnet
    192.168.6.1     0.0.0.0         255.255.255.255 UH    100    0        0 ens3   <-- KVM gateway
