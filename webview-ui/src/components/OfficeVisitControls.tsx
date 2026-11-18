import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { useCast } from '../characters/castStore.js';
import { characterLabel } from '../characters/profiles.js';
import { useDismiss } from '../hooks/useDismiss.js';
import { CharacterMugShot } from './CharacterMugShot.js';
import { Button } from './ui/Button.js';

interface OfficeVisitControlsProps {
  visiting: boolean;
  onEnter: (palette: number) => boolean;
  onLeave: () => void;
}

export function OfficeVisitControls({ visiting, onEnter, onLeave }: OfficeVisitControlsProps) {
  const { profiles } = useCast();
  const [choosing, setChoosing] = useState(false);
  const [entryFailed, setEntryFailed] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const firstChoice = useRef<HTMLButtonElement>(null);
  const pickerId = useId();
  const headingId = useId();
  const open = choosing && !visiting;

  const closePicker = useCallback(() => {
    setChoosing(false);
    setEntryFailed(false);
  }, []);
  useDismiss(open, root, closePicker);

  useEffect(() => {
    if (open) firstChoice.current?.focus();
  }, [open]);

  const enter = (palette: number) => {
    if (onEnter(palette)) closePicker();
    else setEntryFailed(true);
  };

  return (
    <div
      ref={root}
      className="pointer-events-none relative flex flex-col items-center gap-4"
      onKeyDown={(event) => {
        if (!open || event.key !== 'Escape') return;
        event.stopPropagation();
        trigger.current?.focus();
        closePicker();
      }}
    >
      <Button
        ref={trigger}
        type="button"
        size="md"
        variant={open ? 'active' : 'default'}
        disabled={!visiting && profiles.length === 0}
        aria-expanded={visiting ? undefined : open}
        aria-controls={open ? pickerId : undefined}
        className="pointer-events-auto min-h-40 whitespace-nowrap border-border! shadow-pixel disabled:cursor-default disabled:opacity-(--btn-disabled-opacity)"
        onClick={() => {
          if (visiting) {
            onLeave();
            trigger.current?.focus();
          } else if (open) closePicker();
          else setChoosing(true);
        }}
      >
        {visiting ? 'Leave office' : 'Walk around'}
      </Button>
      {visiting && (
        <p className="pixel-panel max-w-224 select-none px-8 py-4 text-xs leading-tight text-text-muted">
          Pick a tile, chair, pet, or desk.
        </p>
      )}
      {open && (
        <section
          id={pickerId}
          aria-labelledby={headingId}
          className="pixel-panel pointer-events-auto absolute left-1/2 top-full mt-4 w-224 -translate-x-1/2 p-6"
        >
          <h2 id={headingId} className="m-0 px-4 pb-6 text-base text-accent-bright">
            Choose your character
          </h2>
          <div className="pixel-scrollbar grid max-h-[min(208px,40dvh)] grid-cols-3 gap-4 overflow-y-auto overscroll-contain p-2">
            {profiles.map((profile, palette) => {
              const label = characterLabel(profile, palette);
              return (
                <Button
                  key={profile.id}
                  ref={palette === 0 ? firstChoice : undefined}
                  type="button"
                  size="sm"
                  title={label}
                  className="flex min-w-0 flex-col items-center gap-2 px-2"
                  onClick={() => enter(palette)}
                >
                  <span aria-hidden="true">
                    <CharacterMugShot palette={palette} repeat={0} />
                  </span>
                  <span className="w-full truncate text-xs">{label}</span>
                </Button>
              );
            })}
          </div>
          <div role="status">
            {entryFailed && (
              <p className="m-0 px-4 pt-6 text-xs text-status-error">
                The office has no open floor tiles.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
