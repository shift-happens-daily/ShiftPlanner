import { useMemo } from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';

export function useTabResponsive(maxWidth = 1200) {
  const isMobile = useIsMobile();

  return useMemo(() => ({
    isMobile,
    page: {
      padding: isMobile ? 10 : 22,
      overflowY: isMobile ? 'auto' : undefined,
      height: isMobile ? 'auto' : '100%',
      overflowX: 'hidden',
    },
    shell: {
      padding: isMobile ? 14 : 26,
      borderRadius: isMobile ? 18 : 30,
      overflow: isMobile ? 'visible' : undefined,
      height: isMobile ? 'auto' : undefined,
      width: `min(100%, ${maxWidth}px)`,
    },
    title: {
      fontSize: isMobile ? 22 : undefined,
    },
    header: {
      flexDirection: isMobile ? 'column' : undefined,
      alignItems: isMobile ? 'stretch' : undefined,
      gap: isMobile ? 12 : undefined,
    },
    headerStats: {
      width: isMobile ? '100%' : undefined,
      flexWrap: 'wrap',
    },
    splitLayout: (desktopColumns) => ({
      gridTemplateColumns: isMobile ? '1fr' : desktopColumns,
      overflow: isMobile ? 'visible' : undefined,
      gap: isMobile ? 14 : 18,
    }),
    gridCols: (desktopColumns) => (isMobile ? '1fr' : desktopColumns),
    fullWidth: isMobile ? { width: '100%', boxSizing: 'border-box' } : {},
    card: {
      padding: isMobile ? 16 : 28,
      borderRadius: isMobile ? 18 : 30,
    },
    filterRow: isMobile ? {
      flexWrap: 'wrap',
      justifyContent: 'stretch',
      width: '100%',
    } : {},
    searchInput: isMobile ? {
      width: '100%',
      flexShrink: 1,
      minWidth: 0,
    } : {},
    filterSelect: isMobile ? {
      width: '100%',
      minWidth: 0,
      flexShrink: 1,
    } : {},
    listItem: isMobile ? {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: 10,
    } : {},
    actionGroup: isMobile ? {
      width: '100%',
      flexShrink: 1,
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: 8,
    } : {},
    listHeader: isMobile ? {
      flexDirection: 'column',
      alignItems: 'stretch',
    } : {},
    panelHeader: isMobile ? {
      flexDirection: 'column',
      alignItems: 'stretch',
    } : {},
    modeSegment: isMobile ? {
      flexDirection: 'column',
    } : {},
    modeButton: isMobile ? {
      width: '100%',
    } : {},
    availabilityGrid: isMobile ? {
      gridTemplateColumns: '52px repeat(7, minmax(48px, 1fr))',
    } : {},
    reportCard: {
      padding: '14px 16px',
      borderRadius: 16,
      background: '#f4faff',
      border: '1px solid #dee7e7',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    },
    reportCardRow: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 12,
      fontSize: 14,
      color: '#4f646f',
    },
    reportCardValue: {
      color: '#002642',
      fontWeight: 800,
    },
  }), [isMobile, maxWidth]);
}
