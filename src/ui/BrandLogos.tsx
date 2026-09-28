import React from 'react';
import Svg, { Path } from 'react-native-svg';

// ---------------------------------------------------------------------------
// Official provider marks, drawn as vectors so they stay crisp at any size.
// Both Google and Apple require their own artwork on sign-in buttons — these
// are the standard marks, not redrawn approximations, so don't restyle the
// Google "G" colours or recolour the Apple mark beyond light/dark.
// ---------------------------------------------------------------------------

/** Google's four-colour "G". Colours are fixed by Google's brand guidelines. */
export function GoogleLogo({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Path
        fill="#4285F4"
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.258h2.909c1.702-1.567 2.683-3.874 2.683-6.614z"
      />
      <Path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.259c-.806.54-1.837.859-3.047.859-2.344 0-4.328-1.583-5.036-3.71H.957v2.332C2.438 15.983 5.482 18 9 18z"
      />
      <Path
        fill="#FBBC05"
        d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.348 6.173 0 7.548 0 9s.348 2.827.957 4.042L3.964 10.71z"
      />
      <Path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.346l2.582-2.582C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </Svg>
  );
}

/**
 * Apple's mark. Monochrome by design — it inverts for dark backgrounds
 * rather than taking a colour of its own.
 */
export function AppleLogo({ size = 22, color = '#000000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M17.05 12.536c-.024-2.71 2.213-4.01 2.313-4.073-1.259-1.84-3.219-2.093-3.916-2.121-1.667-.169-3.253.981-4.099.981-.844 0-2.148-.956-3.53-.93-1.816.027-3.49 1.056-4.425 2.683-1.885 3.271-.482 8.115 1.353 10.767.897 1.297 1.967 2.756 3.372 2.703 1.353-.055 1.864-.875 3.5-.875 1.635 0 2.096.875 3.526.848 1.455-.026 2.376-1.323 3.266-2.625 1.03-1.506 1.454-2.964 1.479-3.039-.032-.014-2.838-1.089-2.866-4.319zM14.37 4.55c.747-.905 1.25-2.163 1.113-3.417-1.075.044-2.379.716-3.151 1.62-.692.8-1.298 2.081-1.135 3.309 1.2.093 2.425-.61 3.173-1.512z"
      />
    </Svg>
  );
}
