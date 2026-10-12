#!/bin/zsh
set -u

capture_dir=${0:A:h}
build_dir=/private/tmp/jimcommand-mosaic-probes
mkdir -p "$build_dir"

clang -Wall -Wextra -framework CoreMIDI -framework CoreFoundation \
  "$capture_dir/midi_probe.c" -o "$build_dir/midi_probe"

clang -fobjc-arc -Wall -Wextra -framework Foundation -framework IOBluetooth \
  "$capture_dir/bluetooth_probe.m" -o "$build_dir/bluetooth_probe"

clang -fobjc-arc -fblocks -Wall -Wextra -framework Foundation -framework CoreBluetooth \
  "$capture_dir/ble_probe.m" -o "$build_dir/ble_probe"

echo "=== USB devices ==="
ioreg -r -c IOUSBHostDevice -l -w 0 | \
  rg -n -C 8 'Mosaic|Ember|13251|4866|REDACTED_SERIAL|USB Product Name|USB Vendor Name|idVendor|idProduct'

echo "=== CoreMIDI and standard identity request ==="
"$build_dir/midi_probe"

echo "=== Classic Bluetooth and SDP ==="
"$build_dir/bluetooth_probe"

echo "=== BLE and GATT (20-second scan) ==="
"$build_dir/ble_probe"
