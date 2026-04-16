import { cn } from "@/lib/utils";
import type { MaterialCategory } from "@/features/application/types";

type GuidanceBlock = {
  title?: string;
  items: readonly string[];
};

const GUIDANCE: Record<MaterialCategory, readonly GuidanceBlock[]> = {
  IDENTITY: [
    {
      items: [
        "Foreign nationals: passport identity page together with the facing endorsements or observations page (full spread).",
        "Mainland China: national ID card, front and back.",
        "Hong Kong: Hong Kong identity card.",
        "Macau: Macau identity card.",
        "Taiwan: Mainland Travel Permit for Taiwan Residents (台胞证).",
      ],
    },
  ],
  EDUCATION: [
    {
      items: [
        "Doctoral degree evidence is required (at least one file in this category).",
        "Degree certificate scan (original document strongly preferred).",
        "Official transcript when available (optional).",
        "Certified translation or a signed verification letter if you cannot provide the original.",
      ],
    },
  ],
  EMPLOYMENT: [
    {
      items: [
        "Latest employment evidence is required (at least one file in this category).",
        "Employment contract, employer reference letter, or HR attestation.",
        "Work booklet where customary (for example in some post-Soviet jurisdictions).",
        "Resignation or release letter, promotion notices, or comparable employment milestones.",
      ],
    },
  ],
  PROJECT: [
    {
      items: [
        "Project proposal or charter that states funding sources (required when applicable).",
        "Progress or final reports, grant award letters, and official confirmation notices.",
        "Certificates of project awards and authoritative screenshots (funder site, university, or national academic body).",
      ],
    },
  ],
  PAPER: [
    {
      items: [
        "Upload full-text copies of published papers (preferred source files).",
        "Include DOI, journal information, or publication metadata in the file when available.",
      ],
    },
  ],
  BOOK: [
    {
      items: [
        "Provide publisher website screenshots or scans of the book cover and key metadata pages.",
        "Ensure title, your name, publisher, publication date, and location are clearly visible.",
      ],
    },
  ],
  CONFERENCE: [
    {
      items: [
        "Conference website screenshots, proceedings papers, participation proof, or invitation letters.",
        "Posters should clearly show both the conference name and your name.",
      ],
    },
  ],
  PATENT: [
    {
      items: [
        "Patent certificate or official gazette extract (strongly preferred).",
        "Official registry screenshots and filed application forms when originals are not yet available.",
      ],
    },
  ],
  HONOR: [
    {
      items: [
        "Official website screenshots, honor certificates, thank-you letters, membership or title certificates.",
        "Peer-review or editorial-board letters, trophies or medals that clearly show the honor title and your name.",
      ],
    },
  ],
  PRODUCT: [
    {
      items: [
        "Summarize the product name, innovation aspects, and measurable economic benefits in the text field above.",
        "Attach brochures, one-pagers, deck PDFs, or images that support your product introduction.",
      ],
    },
  ],
};

export function MaterialCategoryGuidance({
  category,
}: {
  category: MaterialCategory;
}) {
  const blocks = GUIDANCE[category];

  return (
    <div className="mt-2 space-y-3 text-left">
      {blocks.map((block, blockIndex) => (
        <div key={block.title ?? `block-${blockIndex}`}>
          {block.title ? (
            <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
              {block.title}
            </p>
          ) : null}
          <ul
            className={cn(
              "list-disc space-y-1.5 pl-4 text-sm leading-6 text-slate-600 marker:text-slate-400",
              block.title ? "mt-1.5" : "",
            )}
          >
            {block.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
