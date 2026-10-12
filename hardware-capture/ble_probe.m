#import <Foundation/Foundation.h>
#import <CoreBluetooth/CoreBluetooth.h>

static NSString *hexData(NSData *data) {
    if (!data) return @"<none>";
    const unsigned char *bytes = data.bytes;
    NSMutableArray<NSString *> *parts = [NSMutableArray arrayWithCapacity:data.length];
    for (NSUInteger i = 0; i < data.length; ++i)
        [parts addObject:[NSString stringWithFormat:@"%02X", bytes[i]]];
    return [parts componentsJoinedByString:@" "];
}

static NSString *propertyNames(CBCharacteristicProperties p) {
    NSMutableArray<NSString *> *n = [NSMutableArray array];
    if (p & CBCharacteristicPropertyBroadcast) [n addObject:@"broadcast"];
    if (p & CBCharacteristicPropertyRead) [n addObject:@"read"];
    if (p & CBCharacteristicPropertyWriteWithoutResponse) [n addObject:@"writeWithoutResponse"];
    if (p & CBCharacteristicPropertyWrite) [n addObject:@"write"];
    if (p & CBCharacteristicPropertyNotify) [n addObject:@"notify"];
    if (p & CBCharacteristicPropertyIndicate) [n addObject:@"indicate"];
    if (p & CBCharacteristicPropertyAuthenticatedSignedWrites) [n addObject:@"authenticatedSignedWrites"];
    if (p & CBCharacteristicPropertyExtendedProperties) [n addObject:@"extendedProperties"];
    if (p & CBCharacteristicPropertyNotifyEncryptionRequired) [n addObject:@"notifyEncryptionRequired"];
    if (p & CBCharacteristicPropertyIndicateEncryptionRequired) [n addObject:@"indicateEncryptionRequired"];
    return [n componentsJoinedByString:@","];
}

@interface BLEProbe : NSObject <CBCentralManagerDelegate, CBPeripheralDelegate>
@property CBCentralManager *central;
@property CBPeripheral *target;
@property CBUUID *midiService;
@end

@implementation BLEProbe
- (instancetype)init {
    if ((self = [super init])) {
        _midiService = [CBUUID UUIDWithString:@"03B80E5A-EDE8-4B33-A751-6CE34EC4C700"];
        _central = [[CBCentralManager alloc] initWithDelegate:self queue:dispatch_get_main_queue()
                                                      options:@{CBCentralManagerOptionShowPowerAlertKey: @NO}];
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 20 * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
            printf("TIMEOUT after 20 seconds target=%s\n",
                   (self.target.identifier.UUIDString ?: @"none").UTF8String);
            [self.central stopScan];
            if (self.target) [self.central cancelPeripheralConnection:self.target];
            fflush(stdout);
            exit(self.target ? 0 : 3);
        });
    }
    return self;
}

- (void)centralManagerDidUpdateState:(CBCentralManager *)central {
    printf("CENTRAL state=%ld authorization=%ld\n", (long)central.state,
           (long)CBCentralManager.authorization);
    if (central.state == CBManagerStateUnauthorized || central.state == CBManagerStateUnsupported) {
        fflush(stdout);
        exit(2);
    }
    if (central.state != CBManagerStatePoweredOn) return;
    printf("SCAN all BLE peripherals\n");
    [central scanForPeripheralsWithServices:nil
                                    options:@{CBCentralManagerScanOptionAllowDuplicatesKey: @NO}];
}

- (void)centralManager:(CBCentralManager *)central didDiscoverPeripheral:(CBPeripheral *)peripheral
     advertisementData:(NSDictionary<NSString *,id> *)advertisementData RSSI:(NSNumber *)RSSI {
    NSString *localName = advertisementData[CBAdvertisementDataLocalNameKey];
    NSArray<CBUUID *> *services = advertisementData[CBAdvertisementDataServiceUUIDsKey] ?: @[];
    NSData *manufacturer = advertisementData[CBAdvertisementDataManufacturerDataKey];
    NSDictionary *serviceData = advertisementData[CBAdvertisementDataServiceDataKey] ?: @{};
    printf("DISCOVER id=%s peripheralName=\"%s\" localName=\"%s\" rssi=%s connectable=%s services=%s manufacturer=%s serviceData=%s\n",
           peripheral.identifier.UUIDString.UTF8String,
           (peripheral.name ?: @"<nil>").UTF8String,
           (localName ?: @"<nil>").UTF8String,
           RSSI.description.UTF8String,
           [(advertisementData[CBAdvertisementDataIsConnectable] ?: @"<nil>") description].UTF8String,
           services.description.UTF8String,
           hexData(manufacturer).UTF8String,
           serviceData.description.UTF8String);
    fflush(stdout);

    NSString *joinedNames = [NSString stringWithFormat:@"%@ %@", peripheral.name ?: @"", localName ?: @""];
    BOOL namedMosaic = [joinedNames rangeOfString:@"mosaic" options:NSCaseInsensitiveSearch].location != NSNotFound;
    BOOL advertisesMIDI = [services containsObject:self.midiService];
    if (self.target || (!namedMosaic && !advertisesMIDI)) return;
    self.target = peripheral;
    peripheral.delegate = self;
    [central stopScan];
    printf("TARGET selected; CONNECT start\n");
    [central connectPeripheral:peripheral options:nil];
}

- (void)centralManager:(CBCentralManager *)central didConnectPeripheral:(CBPeripheral *)peripheral {
    printf("CONNECT success id=%s name=\"%s\" maxWriteWithResponse=%lu maxWriteWithoutResponse=%lu\n",
           peripheral.identifier.UUIDString.UTF8String,
           (peripheral.name ?: @"<nil>").UTF8String,
           (unsigned long)[peripheral maximumWriteValueLengthForType:CBCharacteristicWriteWithResponse],
           (unsigned long)[peripheral maximumWriteValueLengthForType:CBCharacteristicWriteWithoutResponse]);
    [peripheral discoverServices:nil];
}

- (void)centralManager:(CBCentralManager *)central didFailToConnectPeripheral:(CBPeripheral *)peripheral
                 error:(NSError *)error {
    printf("CONNECT failed error=%s\n", (error.description ?: @"<nil>").UTF8String);
}

- (void)centralManager:(CBCentralManager *)central didDisconnectPeripheral:(CBPeripheral *)peripheral
             timestamp:(CFAbsoluteTime)timestamp isReconnecting:(BOOL)isReconnecting error:(NSError *)error {
    printf("DISCONNECT timestamp=%f reconnecting=%s error=%s\n", timestamp,
           isReconnecting ? "yes" : "no", (error.description ?: @"<nil>").UTF8String);
}

- (void)peripheral:(CBPeripheral *)peripheral didDiscoverServices:(NSError *)error {
    printf("SERVICES result error=%s count=%lu\n", (error.description ?: @"<nil>").UTF8String,
           (unsigned long)peripheral.services.count);
    for (CBService *service in peripheral.services) {
        printf("SERVICE uuid=%s primary=%s\n", service.UUID.UUIDString.UTF8String,
               service.isPrimary ? "yes" : "no");
        [peripheral discoverCharacteristics:nil forService:service];
    }
}

- (void)peripheral:(CBPeripheral *)peripheral didDiscoverCharacteristicsForService:(CBService *)service
              error:(NSError *)error {
    printf("CHARACTERISTICS service=%s error=%s count=%lu\n", service.UUID.UUIDString.UTF8String,
           (error.description ?: @"<nil>").UTF8String, (unsigned long)service.characteristics.count);
    for (CBCharacteristic *characteristic in service.characteristics) {
        printf("CHAR uuid=%s properties=[%s]\n", characteristic.UUID.UUIDString.UTF8String,
               propertyNames(characteristic.properties).UTF8String);
        if (characteristic.properties & CBCharacteristicPropertyRead)
            [peripheral readValueForCharacteristic:characteristic];
        if (characteristic.properties & (CBCharacteristicPropertyNotify | CBCharacteristicPropertyIndicate))
            [peripheral setNotifyValue:YES forCharacteristic:characteristic];
        [peripheral discoverDescriptorsForCharacteristic:characteristic];
    }
}

- (void)peripheral:(CBPeripheral *)peripheral didUpdateValueForCharacteristic:(CBCharacteristic *)characteristic
              error:(NSError *)error {
    printf("VALUE char=%s error=%s data=%s\n", characteristic.UUID.UUIDString.UTF8String,
           (error.description ?: @"<nil>").UTF8String, hexData(characteristic.value).UTF8String);
}

- (void)peripheral:(CBPeripheral *)peripheral didUpdateNotificationStateForCharacteristic:(CBCharacteristic *)characteristic
              error:(NSError *)error {
    printf("NOTIFY char=%s active=%s error=%s\n", characteristic.UUID.UUIDString.UTF8String,
           characteristic.isNotifying ? "yes" : "no", (error.description ?: @"<nil>").UTF8String);
}

- (void)peripheral:(CBPeripheral *)peripheral didDiscoverDescriptorsForCharacteristic:(CBCharacteristic *)characteristic
              error:(NSError *)error {
    printf("DESCRIPTORS char=%s error=%s count=%lu\n", characteristic.UUID.UUIDString.UTF8String,
           (error.description ?: @"<nil>").UTF8String, (unsigned long)characteristic.descriptors.count);
    for (CBDescriptor *descriptor in characteristic.descriptors) [peripheral readValueForDescriptor:descriptor];
}

- (void)peripheral:(CBPeripheral *)peripheral didUpdateValueForDescriptor:(CBDescriptor *)descriptor
              error:(NSError *)error {
    printf("DESCRIPTOR uuid=%s error=%s value=%s\n", descriptor.UUID.UUIDString.UTF8String,
           (error.description ?: @"<nil>").UTF8String,
           (descriptor.value ? [descriptor.value description] : @"<nil>").UTF8String);
}
@end

int main(void) {
    @autoreleasepool {
        __unused BLEProbe *probe = [BLEProbe new];
        [[NSRunLoop mainRunLoop] run];
    }
    return 0;
}
