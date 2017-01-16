Another PC Upgrade
==================

My current workstation, the PC in my basement that I built from parts and do all my
work on, was last upgraded over five years ago.  I thought I'd refresh it, find a nice
used cpu and grab a bit more performance while waiting for the new AMD Zen processors.

Didn't work out that way.


The Ideal Upgrade
-----------------

My usual upgrade is to find a moderately aged CPU, and possibly a motherboard and
memory to go with it, all for around $150.  My old setup was a Phenom II unlocked
and overclocked to X4 3600 in an AM3 motherboard with 8GB of DDR3 memory.

I've had good luck with AMD, Via and Cyrix chips since my Intel Pentium 133, so
looked there first.

AMD

$100. Could get a hex-core Phenom, still uses the AM3 socket, could reuse memory and
cooler.  Benchmarked 44% faster at compiling sources, due to having 6 not 4 cores.

$175. Very nice AMD cpus can be had for $100 used (8350).  Can reuse DDR3 memory and
cooler, but need AM3+ motherboard, $75.  Performance improvement is just for cores
and clock, the Phenom II was faster clock-for-clock than Bulldozer.  Benchmarked at
65-80% faster at compiling, using 2x the cores.

Nice, low cost, easy upgrades, but are an old architecture, use more power, and are
at an evolutionary end with no future.  And not much of a speedup, overall.  After
5 years using the same cpu, I wanted a qualitative change, not a minor bump.

So I looked at what Intel had been up to.

Intel

$225. Sandy Bridge (i7-2600k 3.4g) is $150, needs a different motherboard ($50 and up
socket 1155), and a $25 cpu cooler.  Benchmarked 45% faster for 2x the threads.  End
of life socket, so no point compared to just getting another AMD.

$300. Ivy Bridge (i7-3770k 3.5g) $200, $75 socket 1155 motherboard, $25 cooler.
Benchmarked 65% faster.  Same end of life socket, also no point over AMD.

$375. Haswell (i7-4790k 4.0g) is $250, plus a $100 motherboard (socket 1150), $25
cooler.  Benchmarked 110-190% faster compiling (ie, 2.1-2.9x the speed).
Overclocks well.  A nice upgrade, though also end of life socket.

$525. Skylake (i7-6700k 4.0g) is the current top of the line.  The unlocked Skylake is
$300, plus $100 and up motherboard (socket 1151), $25 cooler, needs DDR4 memory $100
(but so does Zen).  Benchmarked 165-190% faster (reportedly 14% faster than Haswell
clock-for-clock, but the compile benchmarks are inconsistent).  Overclocks well.  Will
be followed by Kaby Lake next year, using the same socket.  More compute power per cpu
dollar than Haswell, and not counting the DDR4 memory, costs only 13% more.  (The
needed DDR4 can be considered a pre-buy, since it can be reused for Zen later.)

So, a somewhat anemic speedup at the low end, and no compelling cost-benefit at the
mid-range.  You see where this is heading.


TL;DR:
------

Upgraded to Skylake, for $405 including DDR4 (a $115 savings off the original estimate):
- socket 1151 motherboard (GA-Z170-HD3P, 2 pci slots, sane bios) ($65 retail open box)
- i7-6700k cpu (4ghz Skylake, socket 1151, unlocked) ($275 retail)
- Hyper 212 EVO cpu cooler ($25 mail order)
- 8gb ddr4 dram (G.Skill Aegis DDR4-2400, memtest 24 gb/sec with Skylake) ($40 used)

Also got:
- sata dvd-rw ($20)
- Pentium G4400 socket 1151 cpu for testing ($45 used)
- 16gb m.2 pci-e ssd to play with as a caching drive ($16 used)
- pci-e sound card ($25 used Sound Blaster X-Fi) to try
- 128gb m.2 pci-e ssd for the boot/root drive (Samsung 840 Pro CM871a, 525mb/s 425mb/s) ($30 used)
- 350W SeaSonic 80+ Bronze power supply ($18 used)

Removed:
- floppy drive
- ide dvd-rw
- old 320gb wd re3 drive
- scsi cd-rom
- scsi backup tape
- scsi controller
- un-installed docker.io

Swapped out:
- switched to 350W SeaSonic 80+ Bronze power supply from Enermax NAXN 450W (save 11W)
- removed ati x1300 video card in favor of built-in iGPU (HD-530) (save 13W)
- downgraded linux kernel to 3.16 from 4.3 to recognize the iGPU (as an i915, but it works well)
- changed KVM vm cpu type to "Hypervisor Default" (is missing features `svm` and `syscall` on Skylake)

Upshot:
- 2x-2.5x faster nodejs
- 7x-9x faster `make -j8` builds (Only 2.2x faster on retest; 70% faster cores: 22% clock, 41% IPC.
  Old system must have been misconfigured, or slowed by the motherboard.)
- 24W less power consumption
- no worse video performance than x1300 (using the "vesa" and "vbe" Xorg drivers)
- temps above ambient +8* C idle, +46 x8 busy (build), +41 x8 very busy (prime95 at start),
  to +58 x8 very very busy (prime95 at end) (4400 MHz at 1.325V)
  (or 4500 MHz at auto - 0.025V: +1* C idle, +41 x8 build, +40 to +67* C prime95)
- lost support for latest docker.io (needs the 4.3 kernel)
- lost 1900x1200 vga text console mode (had with 4.3 kernel, and vga=383 (0x17F) does not take)

Need:
- usb mass storage (for bios upgrades)
- wider case (to better fit the cpu cooler)
- kernel newer than 4.4 (to recognize skylake chipset voltage and rpm probes)
  (tried 4.8, but was no different, still no voltage or rpm measurements)


Impressions So Far
------------------

It's some good news, some bad news, but by and large more good than bad.

The bad news is that all told, this adds up to close to over $600 in parts, some
essential, some infrastructure, some just to have.

The good news is that the new system uses less power, has much greater memory
bandwidth, and should compile C sources an estimated 2.25 x faster than before.

Update: building node v0.10.42 with gcc 4.9.2, the actual compile time speedup
is 2.17x (-j4 77 sec vs -j8 35.5 sec):
- faster clock 3600 -> 4500 (+25% faster clock)
- more cores 4 physical -> 4 physical + 4 1/4 speed virtual (+26% cores by multithreading; -j8 35.5 vs -j4 44.8 sec)
- higher IPC (+37.5% more instructions per cycle for Skylake vs Phenom II)

The Good.

- node runs 2 to 2.5x faster (spot-checked 0.10.42 (2x), 6.3.0 and 6.9.1 (2.5x))
- large C / C++ builds, eg make -j8 node, run 8-9x faster, much faster than the
  originally estimated 3x.  (May have been an old hardware or old config issue, since
  a retest against the old cpu on a different AM3+ motherboard is only 2.2x faster.)
- the built-in iGPU, HD-530, performs about the same as my old ATI X1300 card for
  text and 1-pixel wide lines and uses 13W less power (at idle).  This is with the
  vesa vbe xorg driver, not the i915 Intel chipset driver.
- power consumption down by 24W, 11W (PSU) + 13W (iGPU)
- enabling hyperthreading yields an additional 25% throughput
- using "auto" voltage lets the cpu idle at very low temperatures (1 degree above ambient)

The Bad.

- X.org as configured does not recognize the HD-530 iGPU, and had to reinstall the X1300
  (A: was a 4.3 kernel thing, 3.16.0 uses the iGPU as an i917 and uses the vbe vesa driver)
- kvm broke; Skylake is missing `svm` and `syscall` needed for the `qemu64` arch
  (A: the "Hypervisor Default" cpu type works, but only that one)
- linux 4.3 does not recognize Skylake, ping localhost is .05 sec (is .02 on linux 4.8)
  (A: is 0.020 on 3.16.0 as well, with skylake)
- Debian no longer makes dependency-free amd64 kernels, they entangle a dependency on the
  libssl1.0.0:amd64 userland library which breaks the package when installed on arch=i386.
  Had to install from a .deb bypassing apt.
- Skylake kernel stats in /sys differ, eg up_threshold not present
  (A: was a 4.3 kernel thing, 3.16.0 works as expected)
- `/sys/devices/system/cpu/cpu?/cpufreq/scaling_governor` = `performance` is not
  taking effect, `/proc/sys/cpuinfo` MHz remains 800.  Cpufreqd changed all to 4000, now
  can't change back ("ondemand" results in i/o error; "performance" and "powersave" are ok.
  Neither change MHz back to 800.) P-State governors share names, but work differently,
  from cpufreq; interface at `/sys/devices/system/cpu/intel_pstate/`.
  (A: was a 4.3 kernel thing, 3.16.0 works as expected)
- `/sys/devices/system/cpu/cpufreq/ondemand/up_threshold` is now missing, breaking rc.local.
  Not clear how quickly the cpu switches to full performance mode.
  (A: was a 4.3 kernel thing, 3.16.0 works as expected)
- using "auto" voltage generates a lot more heat under load than a fixed voltage

The Ugly.

- none of my coolers fit the socket, my two Intel coolers turned out to be socket 775, not 1151.
- cpu cooler 1/8 in too tall, sticks out of case, lid is bowed
  (A: was able to re-close the lid and slide over the cooler.  Is touching though, pressing on the chip.)
- cooler fan speed regulator is touchy, fan becomes audible even with just one core busy
  (because 1 thread busy spikes cpu temp to 64* C.  Curiously, 4 threads is 65* C, 8 is 68* C.)
  (A: selecting "Silent" fan mode in bios seems to have fixed the fan, now speeds up above 66* C, not 54.
  However, if core #2 is the one busy, the fan sounds, because core 2 runs 5* C hotter than the others.)
- core 2 runs 5 to 10* C hotter than the others.  Typical observed temperatures under load are 67-71-62-61.
- the cpu cooler fan thrums at certain higher speeds, the air flowing across the blades
  is causing them to resonate.  Bracing the cooler fins does nothing, but a hand
  2 inches in front of the fan quiets it back down.  Hard to do with the lid closed.
  (A: hasn't been an issue on "Silent" mode)
- linux 4.8 kernel scaling governors all default to "performance", can't seem to change
  (A: was a 4.3 kernel thing, 3.16.0 works as expected)
- the system runs cooler at idle (31* C vs 35*), but hotter under full load (68* C vs 56*) than before
- the case is louder, can hear the hdd more
  (A: lid on but not sealed, and echoes.  Is more like it used to be with the lid on.)
- the new UEFI graphical BIOSes are very slow compared to the old text-only interface.
  Every action has a perceptible lag, very annoying for pointless eye candy.
- the auto-repeat delay and rate are no longer settable in the BIOS, and default to slow.
- the 3.16 linux kernel does not use the 1900x1200 0x17D vga=383 mode, even if requested (always 80x25, ick)
- overclocking Skylake is very non-intuitive, the turbo settings and many available switches
  can override the configured clock
- linux always reads the speed as 4 ghz even when overclocked, both via BCLK and the multiplier
- my old chip turns out to have been a better overclocker than I thought, after removing
  it I got it running at 3800 MHz (could not get it over 3600 in my old setup)


A Word About Power Supplies
---------------------------

An "80 Plus" power supply can pay for itself in a couple of years.  Buying used,
the Bronze is the most cost effective (paying for itself in 1-2 years).

- 80+ certification: min 80% efficiency at 20/50/90% operating load.
  80+ Bronze is 82/85/82%, 80+ Gold is 87/90/87%, 80+ Platinum is 90/92/89%,
  80+ Titanium is 90/92/94/90% at 10/20/50/90% load.  Note the 10%.
- older "good" power supplies were typically 60-75% efficient
- typical computer at idle consumes 60W
- each idle spinning disk is about 6W
- a power supply is most efficient under load, aim for 50-90%
- a power supply is least efficient under light load, do not oversize, try to stay above 20%
- using 10W less saves $17.50 a year at $.20 per kW/hr (suburban residential rates)

A Word About SSD Storage
------------------------

A used 100 GB SSD drive for the root drive can speed boot time 2-3x.  The most
cost-effective choice is a used Samsung 840 or 850 Pro, sustaining streaming
reads and writes of 500 MB/sec, close to the SATA limit.

- SSDs can connect via SATA, SATA over pci-e plug, SATA over M.2 socket, PCI-e x4 card, PCI-e M.2 socket
- USB 2.0 can reach 40 MB/s, USB 3.0 can reach 101 MB/s
- good disks can stream from the platter at over 130 MB/s
- SATA III (and M.2 SATA) is limited to 6 gb/s, ie 750 MB/s; SATA Express 16 gb/s (2 GB/s), M.2 PCIe 32 gb/s (4GB/s)
- read speed of even old M.2 SATA is 400 MB/s, and 2500 MB/s for new drives
- old SSD drives can have very low write rates (16GB: 400r/50w, or 128GB: 500r/140w)
- write speed tends to increase with capacity (PM871 850 Pro: 128G: 540r/140w, 256G: 540r/280w, 512G: 540r/450w)
  But not always (the older CM871a 840 Pro: 128G: 540r/520w, 256G: 540r/520w, 512G: 540r/520w)
- current top of the line SSD is Samsung 960, followed closely by Samsung 950.
  The previous generation top of the line was Samsung 850, OCZ (Toshiba) RD400[MA] (M: M.2, A: PCI-e x4 add-in card),
  Kingston HyperX Predator (M.2 and PCI-e x4 card)
  The Samsung Pro is faster, more durable; the EVO a bit slower (20%) but cheaper.
- NAND flash tech: NVMe.  SLC: single-bit cell, server grade (30k write cycles).
  MLC: multi-bit cell (2 bits) (10k write cycles).  TLC: three-level cell (5k write cycles).
- SSD drives automatically map around bad sectors, and specify "total write volume" before
  the drive goes bad.  Old NAND is around 70TB for 128G, new is 300TB.

A Word About Hyperthreading
---------------------------

Hyperthreading presents virtual cores that the operating system can schedule
work for and run programs on.  The OS thinks all cores are alike, but they're not.

Hyperthreading uses linearly more cpu, but is only worth 26% more cores:
(time to build nodejs v0.10.42 with gcc 4.9.2):
-    -j1 = 165 sec 88.9% cpu
-    -j2 = 83.4 sec 178% cpu
-    -j4 = 44.8 sec 341% cpu (100%)
-    -j5 = 42.0 sec 415% cpu (+6% faster, +24% more cpu)
-    -j8 = 35.4 sec 656% cpu (+26% faster, +92% more cpu)

Hyperthreading creates virtual cores whose % utilization is 80% shared (ie, 4/5 of
the virtual capacity overlaps the physical core's).

This results in some unanticipated performance stats, making capacity planning
tricky.  A reported 50% cpu load is really 80% of capacity, because adding 1/4
again as much load will reach 100% cpu.

A single-core hyperthreaded system will show 2 cores (1 physical, 1 virtual).  One
busy program will show 50% utilization.  Adding a 2nd program will show 100%, but
both will take 60% longer to complete overlapped than singly, because only 25%
additional resources are actually available to do twice the work.

If the virtual cores appear to be idle and the operating system schedules
background (idle thread) jobs for them, these low priority jobs would consume 40%
of the foreground processing resources.

A Word About Skylake Overclocking
---------------------------------

Skylake derives independent clocks for the chip subsystems from a base clock (BCLK)
and a multiplier (factor, ratio).  The core is easily overclockable, but the caches,
integrated graphics, i/o and memory much less so.  Overclocking involves adjusting
the clock multipliers and possibly the core voltage.

My simple 4500 MHz overclock:
- disable turbo mode and flex ratio override
- set base multiplier to x45
- set voltage to "Normal" to have the cpu adjust it to the load
- set dynamic voltage to -0.025 to run cooler, 4500 needs less than the cpu thinks
- set memory speed (I set mine to XMP Profile1 2400, but memory speed does not matter much,
  Skylake has tremendous memory bandwith even at the default 2133 setting)
- reboot.  The BIOS will show 4000 MHz with 4500 turbo mode, Linux will show 4000 MHz,
  but benchmarks will run at 4500.

Oddities:
- "4.00GHz" is baked into chip id, even when running at 4.50 GHz
- BCLK reads back as 99.6 even when 100.5 or 101
- setting the base multiplier still shows the base clock reading as 4000 MHz,
  with the new 4500 setting showing up as the turbo speed
- BIOS shows base and turbo speeds even if turbo is Disabled
- default auto-selects the clock rate based on the load, turbo vs normal vs slow when idle
- default auto-selects voltage based on the clock rate in effect
- if changing the BCLK (base clock):
  turn down uncore ratio, the caches don't overclock as well;
  turn down the graphics slice and graphics unslice ratios, the GPU doesn't overclock well.
