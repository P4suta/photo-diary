import { runPortContract } from '@/test/port-contract'
import { MockPhotoLibrary } from './MockPhotoLibrary'

// Drive the mock through the shared port contract at the seam. In phase 2 the same
// runPortContract just gets called with TauriPhotoLibrary.
runPortContract('MockPhotoLibrary', () => new MockPhotoLibrary())
