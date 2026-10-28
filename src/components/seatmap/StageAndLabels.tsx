import { memo } from 'react';
import { G, Polygon, Rect, Text as SvgText } from 'react-native-svg';

import { localizedText, rowLabelPositions, sectionLabelPosition } from '@/lib/seating/labels';
import { pointsBounds } from '@/lib/seating/seatIndex';
import type { CanvasPoint, LayoutElement, LayoutSection } from '@/types/seating';

import type { SeatMapTheme } from './seatColors';

const SECTION_LABEL_FONT = 26;
const ROW_LABEL_FONT_FACTOR = 1.15;
const STAGE_LABEL_MAX_FONT = 34;
const OUTLINE_FILL_OPACITY = 0.14;
const OUTLINE_STROKE_OPACITY = 0.4;

function polygonPoints(points: CanvasPoint[]): string {
  return points.map(([x, y]) => `${x},${y}`).join(' ');
}

interface LayoutElementViewProps {
  element: LayoutElement;
  language: string;
  theme: SeatMapTheme;
}

function LayoutElementView({ element, language, theme }: LayoutElementViewProps) {
  switch (element.type) {
    case 'stage': {
      const fontSize = Math.min(STAGE_LABEL_MAX_FONT, element.height * 0.45);
      const label = element.label ? localizedText(element.label, element.label_i18n, language) : null;
      return (
        <G>
          <Rect
            x={element.x}
            y={element.y}
            width={element.width}
            height={element.height}
            rx={element.radius ?? 0}
            fill={theme.stage}
          />
          {label ? (
            <SvgText
              x={element.x + element.width / 2}
              y={element.y + element.height / 2 + fontSize * 0.35}
              fontSize={fontSize}
              fontWeight="bold"
              fill={theme.stageLabel}
              textAnchor="middle"
            >
              {label}
            </SvgText>
          ) : null}
        </G>
      );
    }
    case 'label': {
      const rotation = element.rotation ?? 0;
      return (
        <SvgText
          x={element.x}
          y={element.y}
          fontSize={element.font_size ?? 24}
          fill={theme.label}
          textAnchor={element.anchor ?? 'middle'}
          transform={rotation ? `rotate(${rotation} ${element.x} ${element.y})` : undefined}
        >
          {localizedText(element.text, element.text_i18n, language)}
        </SvgText>
      );
    }
    case 'shape': {
      if (element.points.length < 3) return null;
      const bounds = pointsBounds(element.points);
      return (
        <G>
          <Polygon
            points={polygonPoints(element.points)}
            fill={element.fill ?? 'none'}
            stroke={element.stroke ?? 'none'}
            strokeWidth={element.stroke ? 2 : 0}
          />
          {element.label ? (
            <SvgText
              x={(bounds.minX + bounds.maxX) / 2}
              y={(bounds.minY + bounds.maxY) / 2}
              fontSize={SECTION_LABEL_FONT}
              fill={theme.label}
              textAnchor="middle"
            >
              {element.label}
            </SvgText>
          ) : null}
        </G>
      );
    }
    default:
      return null;
  }
}

interface SectionDecorationProps {
  section: LayoutSection;
  language: string;
  seatRadius: number;
  showRowLabels: boolean;
  theme: SeatMapTheme;
}

const SectionDecoration = memo(function SectionDecoration({
  section,
  language,
  seatRadius,
  showRowLabels,
  theme,
}: SectionDecorationProps) {
  const label = sectionLabelPosition(section, language);
  const rowLabels = showRowLabels ? rowLabelPositions(section, seatRadius) : [];
  const rowFont = seatRadius * ROW_LABEL_FONT_FACTOR;
  return (
    <G>
      {section.outline.length >= 3 ? (
        <Polygon
          points={polygonPoints(section.outline)}
          fill={section.color}
          fillOpacity={OUTLINE_FILL_OPACITY}
          stroke={section.color}
          strokeOpacity={OUTLINE_STROKE_OPACITY}
          strokeWidth={2}
        />
      ) : null}
      {label ? (
        <SvgText
          x={label.x}
          y={label.y}
          fontSize={SECTION_LABEL_FONT}
          fontWeight="bold"
          fill={theme.label}
          textAnchor={label.anchor}
          transform={label.rotation ? `rotate(${label.rotation} ${label.x} ${label.y})` : undefined}
        >
          {label.text}
        </SvgText>
      ) : null}
      {rowLabels.map((row) => (
        <SvgText
          key={row.key}
          x={row.x}
          y={row.y + rowFont * 0.35}
          fontSize={rowFont}
          fill={theme.label}
          textAnchor="middle"
        >
          {row.text}
        </SvgText>
      ))}
    </G>
  );
});

export interface StageAndLabelsProps {
  elements: LayoutElement[];
  sections: LayoutSection[];
  language: string;
  seatRadius: number;
  showRowLabels: boolean;
  theme: SeatMapTheme;
}

export const StageAndLabels = memo(function StageAndLabels({
  elements,
  sections,
  language,
  seatRadius,
  showRowLabels,
  theme,
}: StageAndLabelsProps) {
  return (
    <G>
      {elements.map((element) => (
        <LayoutElementView key={element.key} element={element} language={language} theme={theme} />
      ))}
      {sections.map((section) => (
        <SectionDecoration
          key={section.id}
          section={section}
          language={language}
          seatRadius={seatRadius}
          showRowLabels={showRowLabels}
          theme={theme}
        />
      ))}
    </G>
  );
});
