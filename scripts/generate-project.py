#!/usr/bin/env python3
"""Generate a portable two-target Xcode project without third-party dependencies."""
import hashlib, json, plistlib
from pathlib import Path
root=Path(__file__).resolve().parents[1]; ios=root/'iOS'; project=ios/'Harbor.xcodeproj'; project.mkdir(parents=True,exist_ok=True)
objects={}
def ident(key): return hashlib.sha256(key.encode()).hexdigest()[:24].upper()
def obj(key,**values):
 i=ident(key);objects[i]=values;return i
def ref(key,path,kind,tree='<group>'):return obj(key,isa='PBXFileReference',lastKnownFileType=kind,path=path,sourceTree=tree)
def build(key,file):return obj(key,isa='PBXBuildFile',fileRef=file)
appsrc=ref('appsrc','Harbor/HarborApp.swift','sourcecode.swift'); extsrc=ref('extsrc','HarborExtension/SafariWebExtensionHandler.swift','sourcecode.swift')
appProduct=obj('appProduct',isa='PBXFileReference',explicitFileType='wrapper.application',includeInIndex='0',path='Harbor.app',sourceTree='BUILT_PRODUCTS_DIR')
extProduct=obj('extProduct',isa='PBXFileReference',explicitFileType='wrapper.app-extension',includeInIndex='0',path='Harbor Extension.appex',sourceTree='BUILT_PRODUCTS_DIR')
resources=[]; resourceRefs=[]
for path in sorted((root/'Extension').iterdir()):
 kind='folder' if path.is_dir() else 'text.json' if path.suffix=='.json' else 'text'
 r=ref('res'+path.name,'../Extension/'+path.name,kind);resourceRefs.append(r);resources.append(build('build'+path.name,r))
assets=ios/'Harbor/Assets.xcassets'; icons=assets/'AppIcon.appiconset';icons.mkdir(parents=True,exist_ok=True)
(icons/'Icon.png').write_bytes((root/'Extension/icons/icon-1024.png').read_bytes())
(icons/'Contents.json').write_text(json.dumps({'images':[{'filename':'Icon.png','idiom':'universal','platform':'ios','size':'1024x1024'}],'info':{'author':'xcode','version':1}}))
(assets/'Contents.json').write_text('{"info":{"author":"xcode","version":1}}')
assetref=ref('assetref','Harbor/Assets.xcassets','folder.assetcatalog')
# Signing lives in Local.xcconfig, which git ignores, so regenerating or pulling never resets it.
(ios/'Harbor.xcconfig').write_text('// Your team and bundle ID go in Local.xcconfig, which git ignores, so updates never overwrite them.\n// scripts/save-signing.py writes it from the team and bundle ID chosen in Xcode.\nDEVELOPMENT_TEAM =\nHARBOR_BUNDLE_ID = com.example.Harbor\n#include? "Local.xcconfig"\n')
xcconfig=ref('xcconfig','Harbor.xcconfig','text.xcconfig')
privacy={'NSPrivacyTracking':False,'NSPrivacyTrackingDomains':[],'NSPrivacyCollectedDataTypes':[],'NSPrivacyAccessedAPITypes':[]}
for folder in ['Harbor','HarborExtension']:(ios/folder/'PrivacyInfo.xcprivacy').write_bytes(plistlib.dumps(privacy))
appPrivacy=ref('appPrivacy','Harbor/PrivacyInfo.xcprivacy','text.xml');extPrivacy=ref('extPrivacy','HarborExtension/PrivacyInfo.xcprivacy','text.xml')
common={'CFBundleDevelopmentRegion':'en','CFBundleExecutable':'$(EXECUTABLE_NAME)','CFBundleIdentifier':'$(PRODUCT_BUNDLE_IDENTIFIER)','CFBundleInfoDictionaryVersion':'6.0','CFBundleName':'$(PRODUCT_NAME)','CFBundleShortVersionString':'$(MARKETING_VERSION)','CFBundleVersion':'$(CURRENT_PROJECT_VERSION)'}
(ios/'Harbor/Info.plist').write_bytes(plistlib.dumps({**common,'CFBundlePackageType':'APPL','LSRequiresIPhoneOS':True,'UILaunchScreen':{},'UIApplicationSceneManifest':{'UIApplicationSupportsMultipleScenes':True},'UISupportedInterfaceOrientations':['UIInterfaceOrientationPortrait','UIInterfaceOrientationLandscapeLeft','UIInterfaceOrientationLandscapeRight'],'UISupportedInterfaceOrientations~ipad':['UIInterfaceOrientationPortrait','UIInterfaceOrientationPortraitUpsideDown','UIInterfaceOrientationLandscapeLeft','UIInterfaceOrientationLandscapeRight']}))
(ios/'HarborExtension/Info.plist').write_bytes(plistlib.dumps({**common,'CFBundleDisplayName':'Harbor','CFBundlePackageType':'XPC!','NSExtension':{'NSExtensionPointIdentifier':'com.apple.Safari.web-extension','NSExtensionPrincipalClass':'$(PRODUCT_MODULE_NAME).SafariWebExtensionHandler'}}))
def phase(key,isa,files,**kwargs):return obj(key,isa=isa,buildActionMask='2147483647',files=files,runOnlyForDeploymentPostprocessing='0',**kwargs)
appSources=phase('appSources','PBXSourcesBuildPhase',[build('appSourceBuild',appsrc)])
extSources=phase('extSources','PBXSourcesBuildPhase',[build('extSourceBuild',extsrc)])
appResources=phase('appResources','PBXResourcesBuildPhase',[build('assetBuild',assetref),build('appPrivacyBuild',appPrivacy)])
extResources=phase('extResources','PBXResourcesBuildPhase',resources+[build('extPrivacyBuild',extPrivacy)])
embedBuild=obj('embedBuild',isa='PBXBuildFile',fileRef=extProduct,settings={'ATTRIBUTES':['RemoveHeadersOnCopy']})
embed=phase('embed','PBXCopyFilesBuildPhase',[embedBuild],dstPath='',dstSubfolderSpec='13',name='Embed App Extensions')
proxy=obj('proxy',isa='PBXContainerItemProxy',containerPortal=ident('project'),proxyType='1',remoteGlobalIDString=ident('extension'),remoteInfo='Harbor Extension')
dep=obj('dependency',isa='PBXTargetDependency',target=ident('extension'),targetProxy=proxy)
def configs(key,settings,base=None):
 refs=[]
 for name in ['Debug','Release']:
  values={**settings,'SWIFT_OPTIMIZATION_LEVEL':'-Onone' if name=='Debug' else '-O'}
  refs.append(obj(key+name,isa='XCBuildConfiguration',**({'baseConfigurationReference':base} if base else {}),buildSettings=values,name=name))
 return obj(key+'ConfigList',isa='XCConfigurationList',buildConfigurations=refs,defaultConfigurationIsVisible='0',defaultConfigurationName='Release')
shared={'SDKROOT':'iphoneos','IPHONEOS_DEPLOYMENT_TARGET':'16.4','SWIFT_VERSION':'5.0','CLANG_ENABLE_MODULES':'YES','TARGETED_DEVICE_FAMILY':'1,2','CODE_SIGN_STYLE':'Automatic','CURRENT_PROJECT_VERSION':'1','MARKETING_VERSION':'0.1.0','GENERATE_INFOPLIST_FILE':'NO','LD_RUNPATH_SEARCH_PATHS':'$(inherited) @executable_path/Frameworks','ENABLE_USER_SCRIPT_SANDBOXING':'YES'}
appconf=configs('app',{**shared,'PRODUCT_BUNDLE_IDENTIFIER':'$(HARBOR_BUNDLE_ID)','PRODUCT_NAME':'Harbor','INFOPLIST_FILE':'Harbor/Info.plist','ASSETCATALOG_COMPILER_APPICON_NAME':'AppIcon'})
extconf=configs('ext',{**shared,'PRODUCT_BUNDLE_IDENTIFIER':'$(HARBOR_BUNDLE_ID).Extension','PRODUCT_NAME':'Harbor Extension','INFOPLIST_FILE':'HarborExtension/Info.plist','APPLICATION_EXTENSION_API_ONLY':'YES','SKIP_INSTALL':'YES','LD_RUNPATH_SEARCH_PATHS':'$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks'})
app=obj('app',isa='PBXNativeTarget',buildConfigurationList=appconf,buildPhases=[appSources,appResources,embed],buildRules=[],dependencies=[dep],name='Harbor',productName='Harbor',productReference=appProduct,productType='com.apple.product-type.application')
ext=obj('extension',isa='PBXNativeTarget',buildConfigurationList=extconf,buildPhases=[extSources,extResources],buildRules=[],dependencies=[],name='Harbor Extension',productName='Harbor Extension',productReference=extProduct,productType='com.apple.product-type.app-extension')
products=obj('products',isa='PBXGroup',children=[appProduct,extProduct],name='Products',sourceTree='<group>')
group=obj('mainGroup',isa='PBXGroup',children=[xcconfig,appsrc,extsrc,assetref,appPrivacy,extPrivacy,*resourceRefs,products],sourceTree='<group>')
projectID=obj('project',isa='PBXProject',attributes={'BuildIndependentTargetsInParallel':'YES','LastUpgradeCheck':'2600'},buildConfigurationList=configs('projectSettings',{},xcconfig),compatibilityVersion='Xcode 14.0',developmentRegion='en',hasScannedForEncodings='0',knownRegions=['en','Base'],mainGroup=group,productRefGroup=products,projectDirPath='',projectRoot='',targets=[app,ext])
def pbx(v,depth=0):
 if isinstance(v,dict):return '{\n'+''.join('\t'*(depth+1)+json.dumps(k)+' = '+pbx(val,depth+1)+';\n' for k,val in v.items())+'\t'*depth+'}'
 if isinstance(v,list):return '('+', '.join(pbx(x,depth) for x in v)+')'
 return json.dumps(str(v))
(project/'project.pbxproj').write_text('// !$*UTF8*$!\n'+pbx({'archiveVersion':'1','classes':{},'objectVersion':'56','objects':objects,'rootObject':projectID})+'\n')
schemes=project/'xcshareddata/xcschemes';schemes.mkdir(parents=True,exist_ok=True)
(schemes/'Harbor.xcscheme').write_text(f'''<?xml version="1.0" encoding="UTF-8"?><Scheme LastUpgradeVersion="2600" version="1.3"><BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{app}" BuildableName="Harbor.app" BlueprintName="Harbor" ReferencedContainer="container:Harbor.xcodeproj"/></BuildActionEntry></BuildActionEntries></BuildAction><LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{app}" BuildableName="Harbor.app" BlueprintName="Harbor" ReferencedContainer="container:Harbor.xcodeproj"/></BuildableProductRunnable></LaunchAction><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/></Scheme>''')
print(project)
