#import "SOBEMeridianBridge.h"
#import <Meridian/Meridian.h>

static BOOL sobeKonfiguriert = NO;

static NSString *SOBEQuelle(MRLocationProviderType typ) {
  switch (typ) {
    case MRLocationProviderTypeBeacons:
      return @"beacons";
    case MRLocationProviderTypeSystem:
      return @"system";
    default:
      return @"unbekannt";
  }
}

static NSDictionary<NSString *, id> *SOBEPosition(MRLocation *location) {
  NSMutableDictionary<NSString *, id> *d = [NSMutableDictionary dictionary];
  d[@"mapId"] = location.mapKey.identifier ?: @"";
  d[@"x"] = @(location.point.x);
  d[@"y"] = @(location.point.y);
  if (location.accuracy >= 0) d[@"genauigkeitM"] = @(location.accuracy);
  NSDate *zeit = location.timestamp ?: [NSDate date];
  d[@"ermitteltAt"] = @((double)[zeit timeIntervalSince1970] * 1000.0);
  d[@"quelle"] = SOBEQuelle(location.providerType);
  return d;
}

@interface SOBEMeridianBridge () <MRLocationManagerDelegate>
@property (nonatomic, strong, nullable) MRLocationManager *manager;
@property (nonatomic, copy, nullable) SOBEMeridianPositionBlock positionBlock;
@property (nonatomic, copy, nullable) SOBEMeridianFehlerBlock fehlerBlock;
@end

@implementation SOBEMeridianBridge

+ (void)konfiguriereMitToken:(NSString *)token region:(NSString *)region {
  MRDomainRegion domain = [region isEqualToString:@"us"] ? MRDomainRegionUS : MRDomainRegionEU;
  if (!sobeKonfiguriert) {
    MRConfig *config = [[MRConfig alloc] init];
    config.applicationToken = token;
    config.domainConfig.domainRegion = domain;
    // Die Berechtigung holt die App selbst (expo-location) – mit ihren eigenen Begründungstexten
    config.sdkHandlesLocationPermissionRequest = NO;
    // Keine Räume in der Spotlight-Suche des Telefons
    config.disableCoreSpotlightIndexing = YES;
    [Meridian configure:config];
    sobeKonfiguriert = YES;
    return;
  }
  // configure darf nur einmal laufen – spätere Änderungen gehen an die geteilte Konfiguration
  MRConfig *geteilt = [Meridian sharedConfig];
  geteilt.applicationToken = token;
  geteilt.domainConfig.domainRegion = domain;
}

- (void)starteFuerApp:(NSString *)appId position:(SOBEMeridianPositionBlock)position fehler:(SOBEMeridianFehlerBlock)fehler {
  [self stoppe];
  self.positionBlock = position;
  self.fehlerBlock = fehler;
  self.manager = [[MRLocationManager alloc] initWithApp:[MREditorKey keyWithIdentifier:appId]];
  self.manager.delegate = self;
  [self.manager startUpdatingLocation];
}

- (void)stoppe {
  [self.manager stopUpdatingLocation];
  self.manager.delegate = nil;
  self.manager = nil;
  self.positionBlock = nil;
  self.fehlerBlock = nil;
}

+ (void)aktuellePositionFuerApp:(NSString *)appId timeout:(NSTimeInterval)timeout fertig:(SOBEMeridianEinmalBlock)fertig {
  [MRLocationManager getCurrentLocationWithApp:[MREditorKey keyWithIdentifier:appId]
                                       timeout:timeout
                                    completion:^(MRLocation *_Nullable location, NSError *_Nullable error) {
                                      if (location) fertig(SOBEPosition(location), nil);
                                      else fertig(nil, error.localizedDescription ?: @"Keine Position ermittelt");
                                    }];
}

#pragma mark - MRLocationManagerDelegate

- (void)locationManager:(MRLocationManager *)manager didUpdateToLocation:(MRLocation *)location {
  if (self.positionBlock) self.positionBlock(SOBEPosition(location));
}

- (void)locationManager:(MRLocationManager *)manager didFailWithError:(NSError *)error {
  if (self.fehlerBlock) self.fehlerBlock(error.localizedDescription ?: @"Ortung fehlgeschlagen");
}

@end
