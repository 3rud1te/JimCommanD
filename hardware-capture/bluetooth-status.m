#import <Foundation/Foundation.h>
#import <CoreBluetooth/CoreBluetooth.h>
#import <IOBluetooth/IOBluetooth.h>
@interface Probe : NSObject<CBCentralManagerDelegate,CBPeripheralDelegate>
@property CBCentralManager *central;
@property CBPeripheral *target;
@end
@implementation Probe
- (void)centralManagerDidUpdateState:(CBCentralManager *)central {
 printf("BLE state=%ld authorization=%ld\n",(long)central.state,(long)CBCentralManager.authorization); fflush(stdout);
 if(central.state==CBManagerStateUnauthorized||central.state==CBManagerStateUnsupported){exit(2);}
 if(central.state!=CBManagerStatePoweredOn)return;
 NSArray *connected=[central retrieveConnectedPeripheralsWithServices:@[[CBUUID UUIDWithString:@"03B80E5A-EDE8-4B33-A751-6CE34EC4C700"]]];
 for(CBPeripheral *p in connected){if([p.name rangeOfString:@"mosaic" options:NSCaseInsensitiveSearch].location!=NSNotFound)printf("Connected MIDI service: %s %s\n",p.name.UTF8String,p.identifier.UUIDString.UTF8String);}
 [central scanForPeripheralsWithServices:nil options:nil];
}
- (void)centralManager:(CBCentralManager *)central didDiscoverPeripheral:(CBPeripheral *)p advertisementData:(NSDictionary *)ad RSSI:(NSNumber *)rssi {
 NSString *name=p.name ?: ad[CBAdvertisementDataLocalNameKey] ?: @"";
 if([name rangeOfString:@"mosaic" options:NSCaseInsensitiveSearch].location==NSNotFound)return;
 printf("Mosaic BLE name=%s identifier=%s RSSI=%s state=%ld services=%s\n",name.UTF8String,p.identifier.UUIDString.UTF8String,rssi.stringValue.UTF8String,(long)p.state,[ad[CBAdvertisementDataServiceUUIDsKey] description].UTF8String);fflush(stdout);
 if(self.target)return;self.target=p;p.delegate=self;[central connectPeripheral:p options:nil];
}
- (void)centralManager:(CBCentralManager *)c didConnectPeripheral:(CBPeripheral *)p{printf("Mosaic BLE connection succeeded\n");[p discoverServices:@[[CBUUID UUIDWithString:@"03B80E5A-EDE8-4B33-A751-6CE34EC4C700"]]];}
- (void)centralManager:(CBCentralManager *)c didFailToConnectPeripheral:(CBPeripheral *)p error:(NSError *)e{printf("Mosaic BLE connect error=%s\n",e.description.UTF8String);}
- (void)peripheral:(CBPeripheral *)p didDiscoverServices:(NSError *)e{printf("Service discovery error=%s\n",(e.description?:@"none").UTF8String);for(CBService *s in p.services){printf("MIDI service=%s\n",s.UUID.UUIDString.UTF8String);[p discoverCharacteristics:nil forService:s];}}
- (void)peripheral:(CBPeripheral *)p didDiscoverCharacteristicsForService:(CBService *)s error:(NSError *)e{for(CBCharacteristic *ch in s.characteristics)printf("MIDI characteristic=%s properties=0x%lx\n",ch.UUID.UUIDString.UTF8String,(unsigned long)ch.properties);fflush(stdout);}
@end
int main(){@autoreleasepool{
 IOBluetoothDevice *audio=[IOBluetoothDevice deviceWithAddressString:@"00:00:00:00:00:00"];
 printf("Mosaic classic audio remembered name=%s connected=%s paired=%s address=%s\n",(audio.name?:@"unknown").UTF8String,audio.isConnected?"yes":"no",audio.isPaired?"yes":"no",(audio.addressString?:@"unknown").UTF8String);fflush(stdout);
 Probe *p=[Probe new];p.central=[[CBCentralManager alloc]initWithDelegate:p queue:dispatch_get_main_queue() options:@{CBCentralManagerOptionShowPowerAlertKey:@NO}];
 [[NSRunLoop mainRunLoop]runUntilDate:[NSDate dateWithTimeIntervalSinceNow:12]];
 [p.central stopScan];if(p.target)[p.central cancelPeripheralConnection:p.target];puts("Scan finished; no MIDI payload sent.");
}return 0;}
