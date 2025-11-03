type Monaco = typeof import('monaco-editor');

declare global {
  interface Window {
    require?: (
      modules: string[],
      onLoad: (...modules: unknown[]) => void,
      onError?: (error: unknown) => void
    ) => void;
    monaco?: Monaco;
  }
}

let loadPromise: Promise<Monaco> | undefined;

export function loadMonaco(): Promise<Monaco> {
  if (loadPromise) {
    return loadPromise;
  }

  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Monaco can only be loaded in a browser environment.'));
  }

  if (window.monaco) {
    loadPromise = Promise.resolve(window.monaco);
    return loadPromise;
  }

  const amdRequire = window.require;
  if (!amdRequire) {
    return Promise.reject(
      new Error('Monaco AMD loader is not available. Ensure loader.js is included before loading the demo site.')
    );
  }

  loadPromise = new Promise<Monaco>((resolve, reject) => {
    try {
      amdRequire(
        ['vs/editor/editor.main'],
        () => {
          try {
            amdRequire(
              ['vs/language/typescript/tsMode'],
              () => {
                const instance = window.monaco;
                if (instance) {
                  resolve(instance);
                } else {
                  reject(new Error('Monaco loaded but the global instance is missing.'));
                }
              },
              (error) => {
                reject(error instanceof Error ? error : new Error(String(error)));
              }
            );
          } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        },
        (error) => {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      );
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });

  return loadPromise;
}

export function getMonaco(): Monaco {
  if (typeof window === 'undefined' || !window.monaco) {
    throw new Error('Monaco has not finished loading yet.');
  }
  return window.monaco;
}
