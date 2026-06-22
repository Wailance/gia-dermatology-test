#!/usr/bin/env python3
"""Extract correct answer indices from Moodle PDF review (green highlighted rows)."""
import json
import re
import sys
from pathlib import Path

import fitz

GREEN = (0.875, 0.9409999847412109, 0.847000002861023)
TOL = 0.02

ROOT = Path(__file__).resolve().parent.parent
PDF_PATH = ROOT / 'GIA_test.pdf'
OUT_PATH = ROOT / 'data' / 'correct-answers.json'


def is_green_fill(fill):
    if not fill or len(fill) < 3:
        return False
    return all(abs(fill[i] - GREEN[i]) < TOL for i in range(3))


def load_green_rects(doc):
    rects = []
    for page_no, page in enumerate(doc):
        for drawing in page.get_drawings():
            if is_green_fill(drawing.get('fill')):
                rects.append((page_no, drawing['rect']))
    return rects


def line_is_green(page_no, bbox, green_rects):
    rect = fitz.Rect(bbox)
    for p, green in green_rects:
        if p != page_no:
            continue
        overlap = rect & green
        if overlap.is_empty:
            continue
        if overlap.get_area() > rect.get_area() * 0.3:
            return True
    return False


def collect_lines(doc, green_rects):
    lines = []
    for page_no, page in enumerate(doc):
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines'):
                text = ''.join(span['text'] for span in line['spans']).strip()
                if not text:
                    continue
                green = any(
                    line_is_green(page_no, span['bbox'], green_rects)
                    for span in line['spans']
                )
                lines.append({'page': page_no, 'text': text, 'green': green})
    return lines


def parse_questions(lines):
    questions = []
    current = None
    in_options = False

    def flush():
        nonlocal current
        if current and current.get('options'):
            questions.append(current)
        current = None

    for row in lines:
        text = row['text']

        q_match = re.match(r'^Вопрос\s+(\d+)$', text)
        if q_match:
            flush()
            current = {
                'id': int(q_match.group(1)),
                'question': '',
                'options': [],
            }
            in_options = False
            continue

        # Q61 in this PDF has no "Вопрос 61" header
        if (
            text == 'Верно'
            and current
            and current.get('options')
            and not in_options
        ):
            flush()
            current = {'id': None, 'question': '', 'options': []}
            in_options = False
            continue

        if current is None:
            continue

        if text == 'Текст вопроса':
            continue

        if text == 'Выберите один ответ:':
            in_options = True
            continue

        if in_options:
            if text in ('Отзыв',) or text.startswith('Ваш ответ'):
                in_options = False
                continue
            if re.match(r'^(Верно|Неверно|Баллов|Отметить)', text):
                in_options = False
                continue

            opt_match = re.match(r'^([a-e])\.\s*(.+)$', text, re.I)
            cyr_match = re.match(r'^[сc]\.\s*(.+)$', text, re.I)
            if opt_match:
                current['options'].append(
                    {'text': opt_match.group(2).strip(), 'green': row['green']}
                )
            elif cyr_match:
                current['options'].append(
                    {'text': cyr_match.group(1).strip(), 'green': row['green']}
                )
            elif current['options']:
                current['options'][-1]['text'] += ' ' + text
                current['options'][-1]['green'] = (
                    current['options'][-1]['green'] or row['green']
                )
            continue

        if not current['question']:
            current['question'] = text
        elif not re.match(r'^(Верно|Неверно|Баллов|Отметить)', text):
            current['question'] += ' ' + text

    flush()

    # Assign missing id for Q61
    known_ids = {q['id'] for q in questions if q['id'] is not None}
    for q in questions:
        if q['id'] is None:
            for candidate in range(1, 101):
                if candidate not in known_ids:
                    q['id'] = candidate
                    known_ids.add(candidate)
                    break

    return sorted(questions, key=lambda q: q['id'])


def main():
    pdf = sys.argv[1] if len(sys.argv) > 1 else PDF_PATH
    doc = fitz.open(pdf)
    green_rects = load_green_rects(doc)
    lines = collect_lines(doc, green_rects)
    questions = parse_questions(lines)

    correct = {}
    errors = []
    for q in questions:
        greens = [i for i, opt in enumerate(q['options']) if opt['green']]
        if len(greens) != 1:
            errors.append((q['id'], greens, [o['text'][:50] for o in q['options']]))
            continue
        correct[str(q['id'])] = greens[0]

    if errors:
        print('Warning: could not detect single green answer for:', file=sys.stderr)
        for err in errors:
            print(f"  Q{err[0]} greens={err[1]}", file=sys.stderr)

    OUT_PATH.write_text(json.dumps(correct, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Extracted {len(correct)} answers -> {OUT_PATH}')


if __name__ == '__main__':
    main()
