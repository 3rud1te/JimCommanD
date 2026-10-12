// Offline native receive test. No MIDI connection or transmission is made.
#import "MosaicMidi.m"
int main(void) {
    @autoreleasepool {
        MosaicMidi *midi = [MosaicMidi new];
        __block NSArray *lastPacket = nil;
        midi.eventHandler = ^(NSDictionary *event) { lastPacket = event[@"bytes"]; };
        midi.sequence = 1; midi.slot = 1;
        const UInt8 bytes[] = {0xF0,0x7D,0x4E,0x43,0x71,0,2,1,0,0x36,0,0,0x1E,0x10,0,1,1,0,0x52,0x2F,0,8,0,0x64,0x5F,0x3C,0x44,0x1A,0x1A,0,0,0x42,0x6F,0x67,0x58,0x54,0x43,0,0x32,0,0,0,0,0,0,0,0,0,0,0xF7};
        __block BOOL received = NO;
        midi.pending = ^(NSDictionary *result, NSString *error) {
            NSCAssert(!error && [result[@"frame"] count] == 50, @"Capture must survive packet splitting");
            received = YES;
        };
        [midi receive:[NSData dataWithBytes:bytes length:48]];
        NSCAssert(!received, @"Partial frame must not finish request");
        const UInt8 clock = 0xF8;
        [midi receive:[NSData dataWithBytes:&clock length:1]];
        [midi receive:[NSData dataWithBytes:bytes+48 length:2]];
        NSCAssert(received, @"Complete frame missing");
        received = NO; midi.sequence = 2;
        midi.pending = ^(NSDictionary *result, NSString *error) { received = YES; };
        [midi receive:[NSData dataWithBytes:bytes length:50]];
        NSCAssert(!received, @"Old sequence completed a new request");
        midi.sequence = 1;
        midi.pending = ^(NSDictionary *result, NSString *error) {
            NSCAssert(error && !result, @"Device error was not surfaced"); received = YES;
        };
        const UInt8 rejected[] = {0xF0,0x7D,0x4E,0x43,0x71,0,2,1,0,0x36,0,1,0,0,0,0xF7};
        [midi receive:[NSData dataWithBytes:rejected length:sizeof(rejected)]];
        NSCAssert(received, @"Error reply missing");
        const UInt8 footswitch[] = {0xB0, 25, 127};
        [midi receive:[NSData dataWithBytes:footswitch length:sizeof(footswitch)]];
        NSArray *expectedPacket = @[@176, @25, @127];
        NSCAssert([lastPacket isEqualToArray:expectedPacket], @"Raw footswitch packet was not forwarded");
        // A malformed final mask must not complete an otherwise valid reply.
        received = NO; midi.sequence = 1; midi.slot = 1;
        midi.pending = ^(NSDictionary *result, NSString *error) { received = YES; };
        NSMutableData *corrupt = [NSMutableData dataWithBytes:bytes length:sizeof(bytes)];
        ((UInt8 *)corrupt.mutableBytes)[45] = 0x40;
        [midi receive:corrupt];
        NSCAssert(!received, @"Invalid final bitmap completed a request");
        [midi receive:[NSData dataWithBytes:bytes length:sizeof(bytes)]];
        NSCAssert(received, @"Valid capture should still complete after corrupt input");
        puts("Native receive checks passed.");
    }
    return 0;
}
