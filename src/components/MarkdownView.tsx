import React from 'react';
import { Platform, ScrollView, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { marked, Token, Tokens } from 'marked';

export type MarkdownViewProps = {
  content: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accentColor?: string;
};

function renderInline(tokens?: Token[], keyPrefix = 'inline', accentColor?: string): React.ReactNode {
  if (!tokens || !tokens.length) return null;
  return tokens.map((tok, idx) => {
    const key = `${keyPrefix}-${idx}`;
    switch (tok.type) {
      case 'strong':
        return (
          <Text key={key} style={styles.strong}>
            {renderInline((tok as Tokens.Strong).tokens, key, accentColor)}
          </Text>
        );
      case 'em':
        return (
          <Text key={key} style={styles.em}>
            {renderInline((tok as Tokens.Em).tokens, key, accentColor)}
          </Text>
        );
      case 'codespan':
        return (
          <Text key={key} style={[styles.codespan, accentColor ? { color: accentColor, backgroundColor: '#293329' } : undefined]}>
            {(tok as Tokens.Codespan).text}
          </Text>
        );
      case 'del':
        return (
          <Text key={key} style={styles.del}>
            {renderInline((tok as Tokens.Del).tokens, key, accentColor)}
          </Text>
        );
      case 'link': {
        const linkTok = tok as Tokens.Link;
        return (
          <Text key={key} style={[styles.link, accentColor ? { color: accentColor } : undefined]}>
            {linkTok.tokens ? renderInline(linkTok.tokens, key, accentColor) : linkTok.text}
          </Text>
        );
      }
      case 'text': {
        const textTok = tok as Tokens.Text;
        return textTok.tokens && textTok.tokens.length > 0 ? (
          <Text key={key}>{renderInline(textTok.tokens, key, accentColor)}</Text>
        ) : (
          textTok.text
        );
      }
      case 'escape':
        return (tok as Tokens.Escape).text;
      case 'br':
        return '\n';
      default:
        if ('text' in tok && typeof tok.text === 'string') {
          return tok.text;
        }
        return null;
    }
  });
}

function renderListItemContent(item: Tokens.ListItem, keyPrefix: string, accentColor?: string): React.ReactNode {
  if (!item.tokens || !item.tokens.length) {
    return (
      <Text selectable style={styles.paragraphText}>
        {item.text}
      </Text>
    );
  }
  return item.tokens.map((childTok, cIdx) => {
    const cKey = `${keyPrefix}-c-${cIdx}`;
    if (childTok.type === 'list') {
      return renderBlock(childTok, cKey, accentColor);
    }
    if (childTok.type === 'paragraph' || childTok.type === 'text') {
      const inlineToks = (childTok as Tokens.Paragraph | Tokens.Text).tokens;
      return (
        <Text key={cKey} selectable style={styles.paragraphText}>
          {inlineToks && inlineToks.length > 0
            ? renderInline(inlineToks, cKey, accentColor)
            : (childTok as Tokens.Paragraph | Tokens.Text).text}
        </Text>
      );
    }
    return renderBlock(childTok, cKey, accentColor);
  });
}

function renderBlock(tok: Token, key: string, accentColor?: string): React.ReactNode {
  switch (tok.type) {
    case 'heading': {
      const hToken = tok as Tokens.Heading;
      const depth = hToken.depth;
      const headingStyle =
        depth === 1
          ? styles.h1
          : depth === 2
          ? styles.h2
          : depth === 3
          ? styles.h3
          : depth === 4
          ? styles.h4
          : styles.h5;
      return (
        <View key={key} style={styles.headingContainer}>
          {depth === 3 && <View style={[styles.h3AccentBar, accentColor ? { backgroundColor: accentColor } : undefined]} />}
          <Text selectable style={headingStyle}>
            {hToken.tokens ? renderInline(hToken.tokens, key, accentColor) : hToken.text}
          </Text>
        </View>
      );
    }
    case 'paragraph': {
      const pToken = tok as Tokens.Paragraph;
      return (
        <View key={key} style={styles.paragraph}>
          <Text selectable style={styles.paragraphText}>
            {pToken.tokens ? renderInline(pToken.tokens, key, accentColor) : pToken.text}
          </Text>
        </View>
      );
    }
    case 'list': {
      const listToken = tok as Tokens.List;
      return (
        <View key={key} style={styles.listContainer}>
          {listToken.items.map((item, itemIdx) => {
            const itemKey = `${key}-item-${itemIdx}`;
            return (
              <View key={itemKey} style={styles.listItemRow}>
                {listToken.ordered ? (
                  <Text style={[styles.orderedBullet, accentColor ? { color: accentColor } : undefined]}>
                    {`${(typeof listToken.start === 'number' ? listToken.start : 1) + itemIdx}.`}
                  </Text>
                ) : item.task ? (
                  <Text style={item.checked ? styles.taskChecked : styles.taskUnchecked}>
                    {item.checked ? '☑ ' : '☐ '}
                  </Text>
                ) : (
                  <Text style={[styles.bullet, accentColor ? { color: accentColor } : undefined]}>•</Text>
                )}
                <View style={styles.listItemContent}>
                  {renderListItemContent(item, itemKey, accentColor)}
                </View>
              </View>
            );
          })}
        </View>
      );
    }
    case 'blockquote': {
      const bToken = tok as Tokens.Blockquote;
      return (
        <View key={key} style={[styles.blockquote, accentColor ? { borderLeftColor: accentColor } : undefined]}>
          {bToken.tokens ? (
            bToken.tokens.map((bChild, bIdx) => renderBlock(bChild, `${key}-b-${bIdx}`, accentColor))
          ) : (
            <Text selectable style={styles.blockquoteText}>
              {bToken.text}
            </Text>
          )}
        </View>
      );
    }
    case 'table': {
      const tableToken = tok as Tokens.Table;
      return (
        <ScrollView
          key={key}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tableScroll}
          contentContainerStyle={styles.tableScrollContent}
        >
          <View style={styles.tableContainer}>
            <View style={styles.tableHeaderRow}>
              {tableToken.header.map((col, cIdx) => (
                <View key={cIdx} style={[styles.tableCell, styles.tableHeaderCell]}>
                  <Text style={[styles.tableHeaderText, { textAlign: col.align ?? 'left' }]}>
                    {col.tokens ? renderInline(col.tokens, `${key}-th-${cIdx}`, accentColor) : col.text}
                  </Text>
                </View>
              ))}
            </View>
            {tableToken.rows.map((row, rIdx) => (
              <View
                key={rIdx}
                style={[styles.tableRow, rIdx % 2 === 1 && styles.tableRowAlt]}
              >
                {row.map((cell, cIdx) => (
                  <View key={cIdx} style={styles.tableCell}>
                    <Text style={[styles.tableCellText, { textAlign: cell.align ?? 'left' }]}>
                      {cell.tokens ? renderInline(cell.tokens, `${key}-td-${rIdx}-${cIdx}`, accentColor) : cell.text}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      );
    }
    case 'code': {
      const codeToken = tok as Tokens.Code;
      return (
        <View key={key} style={styles.codeBlock}>
          {codeToken.lang ? (
            <View style={styles.codeHeader}>
              <Text style={[styles.codeLang, accentColor ? { color: accentColor } : undefined]}>{codeToken.lang.toUpperCase()}</Text>
            </View>
          ) : null}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.codeScroll}
          >
            <Text selectable style={styles.codeText}>
              {codeToken.text}
            </Text>
          </ScrollView>
        </View>
      );
    }
    case 'hr': {
      return <View key={key} style={styles.hr} />;
    }
    case 'space': {
      return null;
    }
    default: {
      if ('raw' in tok && typeof tok.raw === 'string' && tok.raw.trim()) {
        return (
          <View key={key} style={styles.paragraph}>
            <Text selectable style={styles.paragraphText}>
              {tok.raw}
            </Text>
          </View>
        );
      }
      return null;
    }
  }
}

export function MarkdownView({ content, style, textStyle, accentColor }: MarkdownViewProps) {
  if (!content || !content.trim()) return null;

  try {
    const tokens = marked.lexer(content, { gfm: true, breaks: true });
    return (
      <View style={[styles.root, style]}>
        {tokens.map((tok, idx) => renderBlock(tok, `md-${idx}`, accentColor))}
      </View>
    );
  } catch {
    return (
      <View style={[styles.root, style]}>
        <Text selectable style={[styles.paragraphText, textStyle]}>
          {content}
        </Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  paragraph: {
    marginBottom: 8,
  },
  paragraphText: {
    color: '#E2E8F0',
    fontSize: 15,
    lineHeight: 24,
  },
  strong: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  em: {
    fontStyle: 'italic',
    color: '#E2E8F0',
  },
  codespan: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#7DD3FC',
    backgroundColor: '#1E2533',
    fontSize: 13,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  del: {
    textDecorationLine: 'line-through',
    color: '#64748B',
  },
  link: {
    color: '#38BDF8',
    textDecorationLine: 'underline',
  },
  headingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  h3AccentBar: {
    width: 3,
    height: 14,
    backgroundColor: '#38BDF8',
    borderRadius: 2,
    marginRight: 8,
  },
  h1: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
  },
  h2: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
  },
  h3: {
    color: '#F1F5F9',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
  },
  h4: {
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  h5: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  listContainer: {
    marginVertical: 4,
    gap: 4,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bullet: {
    color: '#38BDF8',
    fontSize: 16,
    lineHeight: 24,
    marginRight: 8,
  },
  orderedBullet: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 24,
    marginRight: 8,
    fontVariant: ['tabular-nums'],
  },
  taskChecked: {
    color: '#38BDF8',
    fontSize: 14,
    lineHeight: 24,
    marginRight: 6,
  },
  taskUnchecked: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 24,
    marginRight: 6,
  },
  listItemContent: {
    flex: 1,
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginVertical: 6,
  },
  blockquoteText: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  tableScroll: {
    marginVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#263143',
    backgroundColor: '#0F131A',
  },
  tableScrollContent: {
    minWidth: '100%',
  },
  tableContainer: {
    minWidth: '100%',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#161D27',
    borderBottomWidth: 1,
    borderBottomColor: '#263143',
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: '#0F131A',
    borderBottomWidth: 1,
    borderBottomColor: '#1A212E',
  },
  tableRowAlt: {
    backgroundColor: '#131822',
  },
  tableCell: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 80,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#1E2635',
  },
  tableHeaderCell: {
    paddingVertical: 10,
    borderRightColor: '#263143',
  },
  tableHeaderText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  tableCellText: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 20,
  },
  codeBlock: {
    backgroundColor: '#0A0D12',
    borderWidth: 1,
    borderColor: '#202838',
    borderRadius: 8,
    marginVertical: 8,
    overflow: 'hidden',
  },
  codeHeader: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#131822',
    borderBottomWidth: 1,
    borderBottomColor: '#202838',
  },
  codeLang: {
    fontSize: 11,
    color: '#7DD3FC',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  codeScroll: {
    padding: 12,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 20,
  },
  hr: {
    height: 1,
    backgroundColor: '#202838',
    marginVertical: 12,
  },
});
