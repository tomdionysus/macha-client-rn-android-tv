import { useCallback, useMemo, useState } from 'react';
import { Image, type ImageStyle } from 'expo-image';
import type { ArtworkRef, MediaApi } from '@macha/core';
import { artworkSources, forgetArtworkUrl, rememberArtworkUrl } from './artworkSources';

/**
 * Artwork that survives a node refusing it, and does not re-download on every
 * catalogue refresh.
 *
 * Two behaviours the web client has and this client did not. Both are worse on
 * a television than on a desktop, because a library screen here is a grid of
 * posters reached over wifi and re-entered constantly.
 */

export function LazyArtwork({
  api,
  artwork,
  style,
  contentFit = 'cover',
  transition = 120,
}: {
  api: MediaApi;
  artwork?: ArtworkRef;
  style?: ImageStyle;
  contentFit?: 'cover' | 'contain';
  transition?: number;
}): React.JSX.Element | null {
  const sources = useMemo(
    () => (artwork ? artworkSources(api, artwork) : []),
    // `artwork.url` changes on every re-sign and must NOT rebuild the plan:
    // that is the churn this component exists to absorb. The id is the
    // identity of the image; the signature is not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, artwork?.id],
  );
  const [index, setIndex] = useState(0);

  const url = sources[index];

  const onError = useCallback(() => {
    if (!artwork) return;
    // The remembered copy did not load, so it is not in the cache after all.
    // Forget it before moving on, or it stays first in the plan forever.
    if (url) forgetArtworkUrl(artwork.id, url);
    // A different node is a different failure domain, so there is nothing to
    // wait for: try the next one immediately.
    setIndex((current) => current + 1);
  }, [artwork, url]);

  const onLoad = useCallback(() => {
    if (artwork && url) rememberArtworkUrl(artwork.id, url);
  }, [artwork, url]);

  // Every node has refused. Render nothing rather than a broken frame; the
  // card's own background is the placeholder.
  if (!url) return null;

  return (
    <Image
      // Keyed by URL so a move to the next node remounts rather than leaving
      // `expo-image` to decide whether a changed `source` warrants a reload.
      key={url}
      source={{ uri: url }}
      style={style}
      contentFit={contentFit}
      transition={transition}
      onError={onError}
      onLoad={onLoad}
    />
  );
}
