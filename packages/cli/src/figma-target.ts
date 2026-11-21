interface PageTarget {
  type: string
  url: string
}

export interface FileTargetState {
  loaded: boolean
  visible: boolean
}

// Only file tabs run the editor and its plugin API. The desktop app also keeps
// shell, new-tab, preload, and file-browser (`/files/...`) pages on figma.com,
// and they never get one.
const FILE_PATH_KINDS = ['design', 'file', 'board'] as const

function filePathKind(url: string): number {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return -1
  }
  if (parsed.hostname !== 'www.figma.com' && parsed.hostname !== 'figma.com') return -1
  const [, kind] = parsed.pathname.split('/')
  return FILE_PATH_KINDS.indexOf(kind as (typeof FILE_PATH_KINDS)[number])
}

export function fileTargets<T extends PageTarget>(targets: T[]): T[] {
  const pages = targets.filter((t) => t.type === 'page')
  return FILE_PATH_KINDS.flatMap((_, rank) => pages.filter((t) => filePathKind(t.url) === rank))
}

// Figma loads the editor only in the tab it shows; tabs restored in the
// background stay cold until opened. Commands bootstrap the plugin API on a
// cold tab, but not on the shown tab while it is still loading.
export const FILE_TARGET_STATE_EXPRESSION = `(() => {
  let loaded = false
  try { loaded = typeof figma === 'object' && figma !== null && !!figma.root } catch {}
  return { loaded, visible: document.visibilityState === 'visible' }
})()`

export interface ChooseFileTargetOptions<T> {
  listTargets: () => Promise<T[]>
  probe: (target: T) => Promise<FileTargetState | null>
  // Keep polling while Figma has no file tab yet, as right after a pipe launch.
  waitForFileTabs?: boolean
  timeoutMs?: number
  intervalMs?: number
  sleep?: (ms: number) => Promise<void>
}

// Prefer the file the user is looking at, then any loaded tab, then the first
// file tab. Wait only while the shown file tab is still loading.
export async function chooseFileTarget<T extends PageTarget>({
  listTargets,
  probe,
  waitForFileTabs = false,
  timeoutMs = 30000,
  intervalMs = 1000,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
}: ChooseFileTargetOptions<T>): Promise<T | undefined> {
  for (let waited = 0; ; waited += intervalMs) {
    const timedOut = waited >= timeoutMs
    const candidates = fileTargets(await listTargets())

    if (candidates.length === 0) {
      if (!waitForFileTabs || timedOut) return undefined
    } else {
      let firstLoaded: T | undefined
      let shownLoading = false
      for (const target of candidates) {
        const state = await probe(target)
        if (state?.loaded && state.visible) return target
        if (state?.loaded) firstLoaded ??= target
        if (state?.visible && !state.loaded) shownLoading = true
      }
      if (!shownLoading || timedOut) return firstLoaded ?? candidates[0]
    }

    await sleep(intervalMs)
  }
}
