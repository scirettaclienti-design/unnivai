// APP-NATIVA — stub minimo delle firme Swift di Capacitor 8.5.3 usate dai plugin locali (solo per scripts/ios/controlla-swift.sh).
// Non entra nel progetto Xcode: là c'è il Capacitor vero (capacitor-swift-pm).
import Foundation
import UIKit
public typealias PluginCallResultData = [String: Any]
public let CAPPluginReturnPromise = "promise"
open class CAPPluginMethod: NSObject { public init(name: String, returnType: String) {} }
public protocol CAPBridgedPlugin: NSObjectProtocol {
    var identifier: String { get }
    var jsName: String { get }
    var pluginMethods: [CAPPluginMethod] { get }
}
public protocol CAPBridgeProtocol: AnyObject { func registerPluginInstance(_ pluginInstance: CAPPlugin) }
open class CAPPluginCall: NSObject {
    public func getString(_ key: String) -> String? { nil }
    public func getString(_ key: String, _ defaultValue: String) -> String { defaultValue }
    public func getDouble(_ key: String) -> Double? { nil }
    public func getDouble(_ key: String, _ defaultValue: Double) -> Double { defaultValue }
    public func resolve() {}
    public func resolve(_ data: PluginCallResultData = [:]) {}
    public func reject(_ message: String, _ code: String? = nil, _ error: Error? = nil, _ data: PluginCallResultData? = nil) {}
}
open class CAPPlugin: NSObject {
    public weak var bridge: CAPBridgeProtocol?
    public override init() {}
    @objc open func load() {}
    public func notifyListeners(_ eventName: String, data: [String: Any]?) {}
}
open class CAPBridgeViewController: UIViewController {
    public weak var bridge: CAPBridgeProtocol?
    open func capacitorDidLoad() {}
}
