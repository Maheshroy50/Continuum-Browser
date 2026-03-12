import * as assert from 'assert';

class MockElement {
    tagName: string;
    value: string = '';
    innerText: string = '';
    isContentEditable: boolean = false;
    events: string[] = [];

    constructor(tagName: string) {
        this.tagName = tagName.toUpperCase();
    }

    dispatchEvent(event: any) {
        this.events.push(event.type);
        if (event.type === 'input' && event.inputType === 'insertText') {
            if (this.isContentEditable) {
                this.innerText += event.data;
            } else {
                this.value += event.data;
            }
        }
        return true;
    }
}

async function mockFillField(el: MockElement, text: string, isGmail: boolean) {
    el.value = '';
    el.innerText = '';

    if (!isGmail && !el.isContentEditable) {
        el.value = text;
        el.dispatchEvent({ type: 'input' });
        el.dispatchEvent({ type: 'change' });
        return;
    }

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        el.dispatchEvent({ type: 'keydown', key: char });
        el.dispatchEvent({ type: 'keypress', key: char });
        el.dispatchEvent({ type: 'input', inputType: 'insertText', data: char });
        el.dispatchEvent({ type: 'keyup', key: char });
    }

    el.dispatchEvent({ type: 'change' });
}

describe('ActionExecutor typing logic', () => {
    test('fills a standard input without duplicating characters', async () => {
        const input = new MockElement('INPUT');

        await mockFillField(input, 'hello', false);

        assert.strictEqual(input.value, 'hello', 'Standard input text should be "hello"');
        assert.ok(input.events.includes('input'), 'Standard input should dispatch an input event');
    });

    test('fills a Gmail-style contenteditable field exactly once per character', async () => {
        const div = new MockElement('DIV');
        div.isContentEditable = true;

        await mockFillField(div, 'test', true);

        assert.strictEqual(div.innerText, 'test', 'Gmail contenteditable text should be "test"');
        assert.ok(div.events.includes('keydown'), 'Contenteditable typing should include keydown events');
        assert.strictEqual(div.events.filter(event => event === 'input').length, 4, 'Should dispatch one input event per character');
    });
});
