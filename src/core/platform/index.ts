export type {
  DeviceFacts,
  DeviceService,
  FileService,
  MediaCapabilities,
  MediaService,
  NetworkService,
  NetworkStatus,
  NotificationLevel,
  NotificationService,
  PlatformKind,
  PlatformServices,
  ScreenInfo,
  StorageService,
  StoredFile,
} from './PlatformServices'

export { createPlatformServices, describePlatform, detectPlatform } from './detect'

export {
  WebDeviceService,
  WebFileService,
  WebMediaService,
  WebNetworkService,
  WebNotificationService,
  createWebConfigurationSource,
  createWebPlatform,
  domParseXml,
} from './web'

export {
  ElectronDeviceService,
  ElectronFileService,
  ElectronMediaService,
  ElectronNetworkService,
  ElectronNotificationService,
  ElectronStorageService,
  createElectronPlatform,
  electronConfigurationSource,
  fileServiceBlobStore,
  type ElectronFileBridge,
} from './electron'

export {
  CapacitorDeviceService,
  CapacitorFileService,
  CapacitorMediaService,
  CapacitorNetworkService,
  CapacitorNotificationService,
  CapacitorStorageService,
  capacitorConfigurationSource,
  capacitorPlatformKind,
  createCapacitorPlatform,
  isCapacitorNative,
} from './capacitor'
