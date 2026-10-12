#import <Foundation/Foundation.h>
#import <IOBluetooth/IOBluetooth.h>

@interface ProbeDelegate : NSObject <IOBluetoothDeviceAsyncCallbacks>
@property BOOL sdpFinished;
@property IOReturn sdpStatus;
@end

@implementation ProbeDelegate
- (void)remoteNameRequestComplete:(IOBluetoothDevice *)device status:(IOReturn)status {
    printf("REMOTE_NAME callback status=0x%08x name=\"%s\"\n", status,
           (device.nameOrAddress ?: @"<nil>").UTF8String);
}
- (void)connectionComplete:(IOBluetoothDevice *)device status:(IOReturn)status {
    printf("CONNECT callback status=0x%08x connected=%s handle=%u\n", status,
           device.isConnected ? "yes" : "no", device.connectionHandle);
}
- (void)sdpQueryComplete:(IOBluetoothDevice *)device status:(IOReturn)status {
    self.sdpStatus = status;
    self.sdpFinished = YES;
    printf("SDP callback status=0x%08x services=%lu\n", status,
           (unsigned long)device.services.count);
}
@end

static void printDevice(IOBluetoothDevice *device, NSString *prefix) {
    printf("%s address=%s name=\"%s\" paired=%s connected=%s handle=%u RSSI=%d rawRSSI=%d class=0x%06x lastName=%s lastServices=%s\n",
           prefix.UTF8String,
           (device.addressString ?: @"<nil>").UTF8String,
           (device.nameOrAddress ?: @"<nil>").UTF8String,
           device.isPaired ? "yes" : "no",
           device.isConnected ? "yes" : "no",
           device.connectionHandle,
           device.RSSI,
           device.rawRSSI,
           device.classOfDevice,
           (device.lastNameUpdate.description ?: @"<nil>").UTF8String,
           ([device getLastServicesUpdate].description ?: @"<nil>").UTF8String);
}

static void printServices(IOBluetoothDevice *device) {
    NSUInteger index = 0;
    for (IOBluetoothSDPServiceRecord *service in device.services) {
        BluetoothRFCOMMChannelID channel = 0;
        BluetoothL2CAPPSM psm = 0;
        IOReturn rfcomm = [service getRFCOMMChannelID:&channel];
        IOReturn l2cap = [service getL2CAPPSM:&psm];
        BluetoothSDPServiceRecordHandle handle = 0;
        IOReturn handleStatus = [service getServiceRecordHandle:&handle];
        printf("SERVICE[%lu] name=\"%s\" handleStatus=0x%08x handle=0x%08x rfcommStatus=0x%08x channel=%u l2capStatus=0x%08x psm=%u\n",
               (unsigned long)index++,
               ([service getServiceName] ?: @"<nil>").UTF8String,
               handleStatus, handle, rfcomm, channel, l2cap, psm);
        printf("  attributes=%s\n", service.attributes.description.UTF8String);
    }
}

int main(void) {
    @autoreleasepool {
        NSString *targetAddress = @"00:00:00:00:00:00";
        NSArray<IOBluetoothDevice *> *paired = IOBluetoothDevice.pairedDevices;
        printf("PAIRED count=%lu\n", (unsigned long)paired.count);
        for (IOBluetoothDevice *device in paired) printDevice(device, @"PAIRED");

        IOBluetoothDevice *target = [IOBluetoothDevice deviceWithAddressString:targetAddress];
        if (!target) {
            printf("TARGET lookup failed for %s\n", targetAddress.UTF8String);
            return 2;
        }
        printDevice(target, @"TARGET before");
        BOOL wasConnected = target.isConnected;

        ProbeDelegate *delegate = [ProbeDelegate new];
        IOReturn nameStatus = [target remoteNameRequest:nil];
        printf("REMOTE_NAME synchronous status=0x%08x name=\"%s\"\n", nameStatus,
               (target.nameOrAddress ?: @"<nil>").UTF8String);

        IOReturn connectStatus = wasConnected ? kIOReturnSuccess : [target openConnection];
        printf("CONNECT synchronous status=0x%08x connected=%s handle=%u\n",
               connectStatus, target.isConnected ? "yes" : "no", target.connectionHandle);
        BOOL connectedDuringProbe = target.isConnected;

        if (target.isConnected) {
            IOReturn authStatus = target.isPaired ? kIOReturnSuccess : [target requestAuthentication];
            printf("AUTH status=0x%08x paired=%s\n", authStatus, target.isPaired ? "yes" : "no");
            IOReturn sdpStart = [target performSDPQuery:delegate];
            printf("SDP start status=0x%08x\n", sdpStart);
            NSDate *deadline = [NSDate dateWithTimeIntervalSinceNow:10.0];
            while (!delegate.sdpFinished && deadline.timeIntervalSinceNow > 0) {
                [[NSRunLoop currentRunLoop] runMode:NSDefaultRunLoopMode
                                         beforeDate:[NSDate dateWithTimeIntervalSinceNow:0.1]];
            }
            printf("SDP finished=%s status=0x%08x\n",
                   delegate.sdpFinished ? "yes" : "no", delegate.sdpStatus);
            printServices(target);
        }

        printDevice(target, @"TARGET after");
        if (!wasConnected && target.isConnected) {
            IOReturn closeStatus = [target closeConnection];
            printf("CLOSE status=0x%08x connected=%s\n", closeStatus,
                   target.isConnected ? "yes" : "no");
        }
        return connectedDuringProbe ? 0 : 3;
    }
}
