// G4's data: a sponsor as the logo components draw it (the plan's sponsor, or the stage's SponsorView).
export interface SponsorLogo {
  /** The sponsor's public name: the logo's alt text, and what shows while it has no logo. */
  readonly name: string;
  /** The cleaned-up logo (`/media/<key>.png` with a `.jxl` beside it), or null until it is uploaded. */
  readonly logo: string | null;
}
