import { runPortContract } from '@/test/port-contract'
import { MockPhotoLibrary } from './MockPhotoLibrary'

// Drive the mock through the shared port contract at the seam. The very same
// runPortContract also runs against the real adapter in TauriPhotoLibrary.test.ts,
// so both implementations are held to one set of invariants.
runPortContract('MockPhotoLibrary', () => new MockPhotoLibrary())
