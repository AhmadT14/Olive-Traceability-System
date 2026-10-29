import { useCallback, useEffect, useEffectEvent, useState } from "react";

// Runs load() when `key` changes, and again on reload(). A null key skips
// loading. Data for the same key stays visible while it reloads.
export function useAsync(load, key) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState({
    runKey: null,
    key: null,
    data: null,
    error: null,
  });
  const runKey = key === null || key === undefined ? null : `${key}#${version}`;
  const runLoad = useEffectEvent(() => load());

  useEffect(() => {
    if (runKey === null) return undefined;
    let active = true;
    runLoad().then(
      (data) => active && setState({ runKey, key, data, error: null }),
      (error) => active && setState({ runKey, key, data: null, error }),
    );
    return () => {
      active = false;
    };
  }, [runKey, key]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const sameKey = state.key === key;
  return {
    data: sameKey ? state.data : null,
    error: state.runKey === runKey ? state.error : null,
    loading: runKey !== null && state.runKey !== runKey,
    reload,
  };
}
