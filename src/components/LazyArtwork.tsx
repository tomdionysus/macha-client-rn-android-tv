import { useCallback, useMemo, useState } from 'react';
import { Image, type ImageStyle } from 'expo-image';
import type { ArtworkRef, MediaApi } from '@machafoundation/core';
import { artworkSources, forgetArtworkUrl, rememberArtworkUrl } from './artworkSources';

/**
 * Artwork that falls back to another node when one refuses it, and does not
 * re-download on every catalogue refresh.
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
    // Keyed on the id: `artwork.url` changes on every re-sign and must not
    // rebuild the plan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, artwork?.id],
  );
  const [index, setIndex] = useState(0);

  const url = sources[index];

  const onError = useCallback(() => {
    if (!artwork) return;
    // Forget a URL that failed, or it stays first in the plan.
    if (url) forgetArtworkUrl(artwork.id, url);
    setIndex((current) => current + 1);
  }, [artwork, url]);

  const onLoad = useCallback(() => {
    if (artwork && url) rememberArtworkUrl(artwork.id, url);
  }, [artwork, url]);

  // Every node refused; the card's background is the placeholder.
  if (!url) return null;

  return (
    <Image
      // Keyed by URL so moving to the next node remounts the image.
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
