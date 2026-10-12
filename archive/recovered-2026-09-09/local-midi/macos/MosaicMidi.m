#import "MosaicMidi.h"
#import <CoreMIDI/CoreMIDI.h>

@interface MosaicMidi ()
@property MIDIClientRef client;
@property MIDIPortRef input;
@property MIDIPortRef output;
@property MIDIEndpointRef source;
@property MIDIEndpointRef destination;
@property NSMutableData *assembly;
@property(copy) MosaicReply pending;
@property NSUInteger slot;
@property UInt16 sequence;
@property NSUInteger generation;
- (void)receive:(NSData *)data;
- (void)finish:(NSDictionary *)result error:(NSString *)error;
@end

static NSString *MIDIName(MIDIObjectRef object) {
    CFStringRef value = NULL;
    if (MIDIObjectGetStringProperty(object, kMIDIPropertyDisplayName, &value) != noErr) return @"";
    return CFBridgingRelease(value) ?: @"";
}

static void MosaicInputCallback(const MIDIPacketList *packets, void *context, void *sourceContext) {
    MosaicMidi *bridge = (__bridge MosaicMidi *)context;
    const MIDIPacket *packet = &packets->packet[0];
    for (UInt32 i = 0; i < packets->numPackets; ++i) {
        NSData *data = [NSData dataWithBytes:packet->data length:packet->length];
        dispatch_async(dispatch_get_main_queue(), ^{ [bridge receive:data]; });
        packet = MIDIPacketNext(packet);
    }
}

@implementation MosaicMidi
- (void)connect:(MosaicReply)reply {
    [self disconnect];
    OSStatus status = MIDIClientCreate(CFSTR("JimCommanD USB"), NULL, NULL, &_client);
    if (status == noErr) status = MIDIInputPortCreate(self.client, CFSTR("Mosaic replies"), MosaicInputCallback, (__bridge void *)self, &_input);
    if (status == noErr) status = MIDIOutputPortCreate(self.client, CFSTR("Mosaic queries"), &_output);
    if (status != noErr) {
        [self disconnect];
        reply(nil, [NSString stringWithFormat:@"macOS MIDI connection failed (%d).", (int)status]);
        return;
    }
    NSUInteger sources = 0, destinations = 0;
    for (ItemCount i = 0; i < MIDIGetNumberOfSources(); ++i) {
        MIDIEndpointRef ep = MIDIGetSource(i);
        if ([MIDIName(ep) isEqualToString:@"Mosaic"]) { self.source = ep; sources++; }
    }
    for (ItemCount i = 0; i < MIDIGetNumberOfDestinations(); ++i) {
        MIDIEndpointRef ep = MIDIGetDestination(i);
        if ([MIDIName(ep) isEqualToString:@"Mosaic"]) { self.destination = ep; destinations++; }
    }
    if (sources != 1 || destinations != 1) {
        [self disconnect];
        reply(nil, sources > 1 || destinations > 1 ? @"More than one Mosaic MIDI device found. Connect one Mosaic." : @"Mosaic USB MIDI input and output were not found. Check its power and USB cable.");
        return;
    }
    status = MIDIPortConnectSource(self.input, self.source, NULL);
    if (status != noErr) {
        [self disconnect];
        reply(nil, [NSString stringWithFormat:@"Could not open Mosaic MIDI input (%d).", (int)status]);
        return;
    }
    reply(@{@"name": @"Mosaic", @"mode": @"inventory-and-controls"}, nil);
}

- (void)readSlot:(NSUInteger)slot reply:(MosaicReply)reply {
    if (!self.source || !self.destination) { reply(nil, @"Connect Mosaic USB first."); return; }
    if (self.pending) { reply(nil, @"A Mosaic read is already in progress."); return; }
    if (slot > 29) { reply(nil, @"AMP slot must be 0–29."); return; }
    self.sequence = self.sequence == 65535 ? 1 : self.sequence + 1;
    self.slot = slot;
    self.assembly = nil;
    self.pending = reply;
    NSUInteger generation = ++self.generation;
    const UInt8 inner[] = {2, self.sequence & 255, self.sequence >> 8, 0x36, 0, 1, 0, slot};
    UInt8 frame[16] = {0xF0, 0x7D, 0x4E, 0x43, 0x70};
    for (unsigned i = 0; i < 7; ++i) {
        frame[5] |= (inner[i] >> 7) << i;
        frame[6 + i] = inner[i] & 127;
    }
    frame[13] = 0; frame[14] = inner[7]; frame[15] = 0xF7;
    MIDIPacketList packets;
    MIDIPacket *packet = MIDIPacketListInit(&packets);
    packet = MIDIPacketListAdd(&packets, sizeof(packets), packet, 0, sizeof(frame), frame);
    OSStatus status = packet ? MIDISend(self.output, self.destination, &packets) : -1;
    if (status != noErr) {
        [self finish:nil error:[NSString stringWithFormat:@"Mosaic USB send failed (%d).", (int)status]];
        return;
    }
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 5 * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
        if (self.pending && generation == self.generation) {
            [self finish:nil error:[NSString stringWithFormat:@"Mosaic did not reply for slot %lu within five seconds. Check the USB connection.", (unsigned long)slot + 1]];
        }
    });
}

- (void)sendControlChange:(NSUInteger)controller value:(NSUInteger)value reply:(MosaicReply)reply {
    if (!self.destination) { reply(nil, @"Connect Mosaic USB first."); return; }
    if (controller > 127 || value > 127) { reply(nil, @"Invalid MIDI control change."); return; }
    const UInt8 message[] = {0xB0, (UInt8)controller, (UInt8)value};
    MIDIPacketList packets;
    MIDIPacket *packet = MIDIPacketListInit(&packets);
    packet = MIDIPacketListAdd(&packets, sizeof(packets), packet, 0, sizeof(message), message);
    OSStatus status = packet ? MIDISend(self.output, self.destination, &packets) : -1;
    if (status != noErr) reply(nil, [NSString stringWithFormat:@"Mosaic MIDI control send failed (%d).", (int)status]);
    else reply(@{@"controller": @(controller), @"value": @(value)}, nil);
}

- (void)receive:(NSData *)data {
    const UInt8 *bytes = data.bytes;
    if (self.eventHandler && data.length) {
        NSMutableArray *values = [NSMutableArray arrayWithCapacity:data.length];
        for (NSUInteger j = 0; j < data.length; ++j) [values addObject:@(bytes[j])];
        self.eventHandler(@{
            @"bytes": values,
            @"receivedAt": @([[NSDate date] timeIntervalSince1970] * 1000.0)
        });
    }
    for (NSUInteger i = 0; i < data.length; ++i) {
        UInt8 byte = bytes[i];
        if (byte >= 0xF8) continue;
        if (byte == 0xF0) self.assembly = [NSMutableData data];
        if (!self.assembly) continue;
        if ((byte >= 0x80 && byte != 0xF0 && byte != 0xF7) || self.assembly.length >= 4096) { self.assembly = nil; continue; }
        [self.assembly appendBytes:&byte length:1];
        if (byte != 0xF7) continue;
        NSData *frame = self.assembly;
        self.assembly = nil;
        if (!self.pending || frame.length < 7) continue;
        const UInt8 *f = frame.bytes;
        if (memcmp(f, "\xF0\x7D\x4E\x43\x71", 5)) continue;
        UInt8 inner[4096]; NSUInteger n = 0; BOOL validPacking = YES;
        for (NSUInteger p = 5; p < frame.length - 1;) {
            UInt8 mask = f[p++];
            NSUInteger count = MIN((NSUInteger)7, frame.length - 1 - p);
            if (!count || (mask >> count)) { validPacking = NO; break; }
            for (unsigned bit = 0; bit < 7 && p < frame.length - 1; ++bit, ++p)
                inner[n++] = f[p] | (((mask >> bit) & 1) << 7);
        }
        if (!validPacking) continue;
        if (n < 8 || inner[0] != 2 || (inner[1] | (inner[2] << 8)) != self.sequence ||
            (inner[3] | (inner[4] << 8)) != 0x36) continue;
        NSUInteger length = inner[6] | (inner[7] << 8);
        if (n != length + 8) { [self finish:nil error:@"Mosaic returned an invalid reply length."]; continue; }
        if (inner[5] != 0) { [self finish:nil error:[NSString stringWithFormat:@"Mosaic rejected slot %lu (status %u).", (unsigned long)self.slot + 1, inner[5]]]; continue; }
        if (length < 30 || inner[8] != self.slot) { [self finish:nil error:@"Mosaic returned an unexpected slot record."]; continue; }
        NSMutableArray *values = [NSMutableArray arrayWithCapacity:frame.length];
        for (NSUInteger j = 0; j < frame.length; ++j) [values addObject:@(f[j])];
        [self finish:@{@"frame": values} error:nil];
    }
}

- (void)finish:(NSDictionary *)result error:(NSString *)error {
    MosaicReply reply = self.pending;
    self.pending = nil;
    self.generation++;
    if (reply) reply(result, error);
}

- (void)disconnect {
    [self finish:nil error:@"Mosaic connection closed."];
    if (self.input) MIDIPortDispose(self.input);
    if (self.output) MIDIPortDispose(self.output);
    if (self.client) MIDIClientDispose(self.client);
    self.input = 0; self.output = 0; self.client = 0;
    self.source = 0; self.destination = 0; self.assembly = nil;
}
@end
