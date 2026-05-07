/**
 * Session Log Generator — converts the raw sessionEvents array into a
 * structured data object for the preview modal and an HTML string for the
 * saved journal entry.
 */

const PHASE_LABELS = {
  'pre-cycle':      'Pre-Cycle',
  'novel':          'Novel Phase',
  'reputation':     'Reputation Phase',
  'rumour-scandal': 'Rumour & Scandal Phase',
  'epistolary':     'Epistolary Phase',
  'upkeep':         'Upkeep Phase',
};

function _ts(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Convert the flat events array into sections grouped by category.
 * @param {Object[]} events
 * @param {{ sessionNumber?: number, cycleNumber?: number }} opts
 * @returns {{ header: Object, sections: Object[], isEmpty: boolean }}
 */
export function generateSessionLog(events, { sessionNumber = 1, cycleNumber = 1 } = {}) {
  const date = new Date().toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });

  if (!events?.length) {
    return {
      header: { sessionNumber, cycleNumber, date, eventCount: 0 },
      sections: [],
      isEmpty: true,
    };
  }

  const groups = {
    phaseChange:    [],
    monologue:      [],
    tagAdded:       [],
    tagRemoved:     [],
    conditionAdded: [],
    personaSwap:    [],
  };
  for (const ev of events) {
    if (groups[ev.type]) groups[ev.type].push(ev);
  }

  const sections = [];

  if (groups.phaseChange.length) {
    sections.push({
      key: 'phaseChange',
      label: game.i18n.localize('GOODSOCIETY.sessionLog.sections.phaseChange'),
      count: groups.phaseChange.length,
      entries: groups.phaseChange.map(ev => ({
        text: PHASE_LABELS[ev.details.newPhase] ?? ev.details.newPhase,
        time: _ts(ev.timestamp),
      })),
    });
  }

  if (groups.monologue.length) {
    sections.push({
      key: 'monologue',
      type: 'monologue',
      label: game.i18n.localize('GOODSOCIETY.sessionLog.sections.monologue'),
      count: groups.monologue.length,
      entries: groups.monologue.map(ev => ({
        actorId:     ev.actorId,
        speakerName: ev.details.speakerName || ev.actorName,
        content:     ev.details.content,
        time:        _ts(ev.timestamp),
      })),
    });
  }

  const repEntries = [
    ...groups.tagAdded.map(ev => ({
      kind: 'tagAdded', actorName: ev.actorName, actorId: ev.actorId,
      tagName: ev.details.tagName, polarity: ev.details.polarity,
      source: ev.details.source, time: _ts(ev.timestamp),
    })),
    ...groups.tagRemoved.map(ev => ({
      kind: 'tagRemoved', actorName: ev.actorName, actorId: ev.actorId,
      tagName: ev.details.tagName, polarity: ev.details.polarity,
      time: _ts(ev.timestamp),
    })),
    ...groups.conditionAdded.map(ev => ({
      kind: 'conditionAdded', actorName: ev.actorName, actorId: ev.actorId,
      conditionName: ev.details.conditionName, polarity: ev.details.polarity,
      time: _ts(ev.timestamp),
    })),
  ];

  if (repEntries.length) {
    sections.push({
      key: 'reputation',
      type: 'reputation',
      label: game.i18n.localize('GOODSOCIETY.sessionLog.sections.reputation'),
      count: repEntries.length,
      entries: repEntries,
    });
  }

  if (groups.personaSwap.length) {
    sections.push({
      key: 'personaSwap',
      type: 'personaSwap',
      label: game.i18n.localize('GOODSOCIETY.sessionLog.sections.personaSwap'),
      count: groups.personaSwap.length,
      entries: groups.personaSwap.map(ev => ({
        actorName:   ev.actorName,
        personaName: ev.details.personaName,
        time:        _ts(ev.timestamp),
      })),
    });
  }

  return {
    header: { sessionNumber, cycleNumber, date, eventCount: events.length },
    sections,
    isEmpty: sections.length === 0,
  };
}

/**
 * Serialize the structured log into HTML for journal storage.
 * Used in both the "edit" seed content and the final save payload.
 */
export function generateSessionLogHTML(log) {
  if (!log || log.isEmpty) {
    return '<em>No mechanical events this session.</em>';
  }

  const parts = [];

  for (const section of log.sections) {
    parts.push(`<h2>${section.label}${section.count ? ` · ${section.count}` : ''}</h2>`);

    if (section.type === 'monologue') {
      for (const e of section.entries) {
        parts.push(
          `<div class="gs-session-log-monologue">` +
          `<p><strong>${e.speakerName}</strong> <em>${e.time}</em></p>` +
          `<blockquote>${e.content}</blockquote></div>`,
        );
      }

    } else if (section.type === 'reputation') {
      const items = section.entries.map(e => {
        const arrow = e.polarity === 'positive' ? '▲' : '▼';
        if (e.kind === 'tagAdded') {
          return `<li><strong>${e.actorName}</strong> gained ${arrow} ${e.tagName}` +
            `${e.source ? ` — ${e.source}` : ''} <em>(${e.time})</em></li>`;
        }
        if (e.kind === 'tagRemoved') {
          return `<li><strong>${e.actorName}</strong> lost ${arrow} ${e.tagName} <em>(${e.time})</em></li>`;
        }
        if (e.kind === 'conditionAdded') {
          return `<li>★ <strong>${e.actorName}</strong>: condition '${e.conditionName}' added <em>(${e.time})</em></li>`;
        }
        return '';
      }).filter(Boolean);
      parts.push(`<ul>${items.join('')}</ul>`);

    } else if (section.type === 'personaSwap') {
      const items = section.entries.map(e =>
        `<li><strong>${e.actorName}</strong> → ${e.personaName} <em>(${e.time})</em></li>`,
      );
      parts.push(`<ul>${items.join('')}</ul>`);

    } else {
      // Generic phase-change or unknown section type
      const items = section.entries.map(e =>
        `<li>· ${e.text ?? ''} <em>(${e.time})</em></li>`,
      );
      parts.push(`<ul>${items.join('')}</ul>`);
    }
  }

  return parts.join('\n');
}
