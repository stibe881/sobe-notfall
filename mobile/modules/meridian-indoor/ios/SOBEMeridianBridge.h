#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// Position als Wörterbuch: mapId, x, y, genauigkeitM, ermitteltAt (ms), quelle
typedef void (^SOBEMeridianPositionBlock)(NSDictionary<NSString *, id> *position);
typedef void (^SOBEMeridianFehlerBlock)(NSString *meldung);
typedef void (^SOBEMeridianEinmalBlock)(NSDictionary<NSString *, id> *_Nullable position, NSString *_Nullable fehler);

/**
 * Dünne Objective-C-Schicht über dem Meridian-SDK.
 *
 * Das SDK ist in Objective-C geschrieben; hier stehen seine Aufrufe genau so,
 * wie sie in den Headern stehen. Das Swift-Modul sieht nur diese Klasse mit
 * einfachen Typen – so hängt nichts an der automatischen Übersetzung der
 * Methodennamen nach Swift.
 */
NS_SWIFT_NAME(MeridianBruecke)
@interface SOBEMeridianBridge : NSObject

/// SDK einrichten. Mehrfach aufrufbar: Nach dem ersten Mal werden Token und Region nur noch angepasst.
+ (void)konfiguriereMitToken:(NSString *)token region:(NSString *)region NS_SWIFT_NAME(konfiguriere(token:region:));

/// Laufende Ortung starten; eine bereits laufende wird ersetzt.
- (void)starteFuerApp:(NSString *)appId
             position:(SOBEMeridianPositionBlock)position
               fehler:(SOBEMeridianFehlerBlock)fehler NS_SWIFT_NAME(starte(appId:position:fehler:));

- (void)stoppe NS_SWIFT_NAME(stoppe());

/// Einmalige Ortung mit Zeitlimit (Sekunden)
+ (void)aktuellePositionFuerApp:(NSString *)appId
                        timeout:(NSTimeInterval)timeout
                          fertig:(SOBEMeridianEinmalBlock)fertig NS_SWIFT_NAME(aktuellePosition(appId:timeout:fertig:));

@end

NS_ASSUME_NONNULL_END
