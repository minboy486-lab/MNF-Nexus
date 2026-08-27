import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import {
  type ControlLook,
  type ControlWidgetId,
} from "../../shared/controlLook";

export type ControlLookEdit = {
  selected: ControlWidgetId | null;
  onSelect: (id: ControlWidgetId | null) => void;
  onMove: (id: ControlWidgetId, ox: number, oy: number) => void;
  previewOn?: boolean;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

type Props = {
  id: ControlWidgetId;
  look: ControlLook | null;
  edit?: ControlLookEdit;
  className?: string;
  children: ReactNode;
};

export function ControlLookWrap({ id, look, edit, className, children }: Props) {
  const w = look?.overlay === true ? look.widgets[id] : undefined;
  if (w && w.visible === false && !edit) return null;
  const selected = edit?.selected === id;
  const ox = w?.ox ?? 0;
  const oy = w?.oy ?? 0;
  const hasLook =
    !!edit ||
    ox !== 0 ||
    oy !== 0 ||
    w?.sizeSet === true ||
    w?.colorSet === true ||
    w?.scaleSet === true ||
    (w?.rot ?? 0) !== 0 ||
    (w != null && w.visible === false);
  if (!hasLook) return <>{children}</>;

  const drag = edit
    ? {
        onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
          if (e.button !== 0) return;
          const nested = (e.target as HTMLElement | null)?.closest("[data-widget]");
          if (nested && nested !== e.currentTarget) return;
          e.preventDefault();
          e.stopPropagation();
          edit.onSelect(id);
          const stage = e.currentTarget.closest(".look-editor__store, .ctrl-stage, .shell.compact") as HTMLElement | null;
          if (!stage) return;
          const rect = stage.getBoundingClientRect();
          const startOx = w?.ox ?? 0;
          const startOy = w?.oy ?? 0;
          const startX = e.clientX;
          const startY = e.clientY;
          const target = e.currentTarget;
          target.setPointerCapture(e.pointerId);
          const move = (ev: PointerEvent) => {
            edit.onMove(
              id,
              clamp(startOx + ((ev.clientX - startX) / rect.width) * 100, -80, 80),
              clamp(startOy + ((ev.clientY - startY) / rect.height) * 100, -80, 80),
            );
          };
          const up = () => {
            target.removeEventListener("pointermove", move);
            target.removeEventListener("pointerup", up);
            target.removeEventListener("pointercancel", up);
          };
          target.addEventListener("pointermove", move);
          target.addEventListener("pointerup", up);
          target.addEventListener("pointercancel", up);
        },
      }
    : {};

  const extra: CSSProperties = {};
  if (ox || oy) extra.transform = `translate(${ox}cqw, ${oy}cqh)`;
  if (w?.sizeSet) extra.fontSize = `${w.fontSize}px`;
  if (w?.colorSet) extra.color = w.color;

  const cls = [
    "ctrl-look-wrap",
    `ctrl-look-wrap--${id}`,
    w?.sizeSet ? "ctrl-look-wrap--size" : "",
    w?.colorSet ? "ctrl-look-wrap--color" : "",
    edit ? "ctrl-item--editing" : "",
    selected ? "ctrl-item--selected" : "",
    w && !w.visible ? "ctrl-item--hidden" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} data-widget={id} style={extra} {...drag}>
      {children}
    </div>
  );
}

type SlotProps = {
  id: ControlWidgetId;
  look: ControlLook | null;
  edit?: ControlLookEdit;
  className: string;
  children: ReactNode;
};

export function FloorSlotLook({ id, look, edit, className, children }: SlotProps) {
  const w = look?.overlay === true ? look.widgets[id] : undefined;
  if (w && w.visible === false && !edit) return null;
  const selected = edit?.selected === id;
  const ox = w?.ox ?? 0;
  const oy = w?.oy ?? 0;
  const rot = w?.rot ?? 0;
  const scale = w?.scaleSet ? (w.scale ?? 1) : 1;

  const drag = edit
    ? {
        onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          edit.onSelect(id);
          const stage = e.currentTarget.closest(".yeoksam-map, .floor-plan--misa") as HTMLElement | null;
          if (!stage) return;
          const rect = stage.getBoundingClientRect();
          const startOx = ox;
          const startOy = oy;
          const startX = e.clientX;
          const startY = e.clientY;
          const target = e.currentTarget;
          target.setPointerCapture(e.pointerId);
          const move = (ev: PointerEvent) => {
            edit.onMove(
              id,
              clamp(startOx + ((ev.clientX - startX) / rect.width) * 100, -80, 80),
              clamp(startOy + ((ev.clientY - startY) / rect.height) * 100, -80, 80),
            );
          };
          const up = () => {
            target.removeEventListener("pointermove", move);
            target.removeEventListener("pointerup", up);
            target.removeEventListener("pointercancel", up);
          };
          target.addEventListener("pointermove", move);
          target.addEventListener("pointerup", up);
          target.addEventListener("pointercancel", up);
        },
      }
    : {};

  const style: CSSProperties = {
    ["--slot-ox" as string]: `${ox}cqw`,
    ["--slot-oy" as string]: `${oy}cqh`,
    ["--slot-rot" as string]: `${rot}deg`,
    ["--slot-scale" as string]: String(scale),
    ...(w?.sizeSet
      ? {
          fontSize: `${w.fontSize}px`,
          ["--slot-label-size" as string]: `${w.fontSize}px`,
        }
      : {}),
    ...(w?.colorSet
      ? {
          color: w.color,
          ["--slot-idle" as string]: w.color,
        }
      : {}),
    ...(w?.colorOnSet && w.colorOn
      ? {
          ["--slot-on" as string]: w.colorOn,
        }
      : {}),
  };

  const cls = [
    className,
    "floor-slot-look",
    w?.sizeSet ? "floor-slot-look--size" : "",
    w?.colorSet ? "floor-slot-look--color" : "",
    w?.colorOnSet ? "floor-slot-look--on-color" : "",
    edit ? "ctrl-item--editing" : "",
    selected ? "ctrl-item--selected" : "",
    w && !w.visible ? "ctrl-item--hidden" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} data-widget={id} style={style} {...drag}>
      {children}
    </div>
  );
}
