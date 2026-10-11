import SafariServices

final class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        let response = NSExtensionItem()
        response.userInfo = [SFExtensionMessageKey: ["error": "Harbor does not expose native messaging actions."]]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
}
