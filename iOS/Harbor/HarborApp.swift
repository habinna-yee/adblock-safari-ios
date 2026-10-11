import SwiftUI

@main
struct HarborApp: App {
    var body: some Scene { WindowGroup { WelcomeView() } }
}

struct WelcomeView: View {
    private let teal = Color(red: 0.03, green: 0.43, blue: 0.51)
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    HStack(spacing: 16) {
                        Image(systemName: "water.waves").font(.system(size: 40)).foregroundStyle(teal).accessibilityHidden(true)
                        VStack(alignment: .leading) {
                            Text("Harbor").font(.largeTitle.bold())
                            Text("Your Safari, with less noise.").foregroundStyle(.secondary)
                        }
                    }
                    Text("A quieter web starts here.").font(.title.bold())
                    Text("Harbor blocks ads and trackers in Safari. Enable the extension, then manage sites and filters directly from Safari’s page menu.")
                    GroupBox {
                        VStack(alignment: .leading, spacing: 20) {
                            step("1", "Enable the extension", "Open Settings → Apps → Safari → Extensions → Harbor, then turn it on. On older iOS versions, Safari appears directly in Settings.")
                            Divider()
                            step("2", "Choose website access", "Allow Harbor on the websites you want to filter. Choose All Websites → Allow for browsing-wide coverage. Private Browsing needs separate permission.")
                            Divider()
                            step("3", "Open Harbor in Safari", "Use Safari’s page menu to open Harbor. Pause blocking for a site, hide an element, or open Settings to edit your filters.")
                        }.padding(8)
                    }
                    Label("No account. No browsing-history log.", systemImage: "lock.shield").font(.headline)
                    Text("Settings stay on this device. Bundled filters work offline and update with new Harbor builds. Website permission enables element hiding and site controls.").font(.subheadline).foregroundStyle(.secondary)
                    GroupBox("Safari has limits") {
                        Text("Harbor cannot block ads in other apps or guarantee removal of every video ad. Safari permissions and content-blocker settings control whether protection can run. After enabling Harbor, reload your open pages.")
                            .font(.subheadline).frame(maxWidth: .infinity, alignment: .leading).padding(.top, 4)
                    }
                    Link(destination: URL(string: "https://example.com")!) {
                        Label("Open a test website", systemImage: "safari").frame(maxWidth: .infinity).padding(8)
                    }.buttonStyle(.borderedProminent).tint(teal)
                    Text("Includes converted EasyList and EasyPrivacy filters, © their contributors, GPLv3. Full sources and conversion reports are included in the project.").font(.caption).foregroundStyle(.secondary)
                }.padding(24).frame(maxWidth: 650)
            }.navigationTitle("Welcome").navigationBarTitleDisplayMode(.inline)
        }
    }
    private func step(_ number: String, _ title: String, _ detail: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Text(number).font(.system(.headline, design: .monospaced)).foregroundStyle(teal).frame(width: 24)
            VStack(alignment: .leading, spacing: 6) { Text(title).font(.headline); Text(detail).font(.subheadline).foregroundStyle(.secondary) }
        }
    }
}
