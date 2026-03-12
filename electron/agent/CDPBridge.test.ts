
import { CDPBridge } from './CDPBridge';
import { WebContents } from 'electron';

// Mock WebContents and Debugger
const mockSendCommand = jest.fn();
const mockAttach = jest.fn();
const mockDetach = jest.fn();

const mockWebContents = {
    debugger: {
        attach: mockAttach,
        detach: mockDetach,
        sendCommand: mockSendCommand,
        isAttached: () => true
    }
} as unknown as WebContents;

describe('CDPBridge', () => {
    let bridge: CDPBridge;

    beforeEach(() => {
        bridge = new CDPBridge();
        mockSendCommand.mockReset();
        mockAttach.mockReset();
        mockDetach.mockReset();
    });

    test('should attach to webContents', async () => {
        const result = await bridge.attach(mockWebContents);
        expect(result).toBe(true);
        expect(mockAttach).toHaveBeenCalledWith('1.3');
    });

    test('should handle attach errors gracefully', async () => {
        mockAttach.mockImplementationOnce(() => { throw new Error('Attach failed'); });
        const result = await bridge.attach(mockWebContents);
        expect(result).toBe(false);
    });

    test('should click node via CDP', async () => {
        await bridge.attach(mockWebContents);
        
        // Mock getBoxModel response
        mockSendCommand.mockImplementation((method, _params) => {
            if (method === 'DOM.getBoxModel') {
                return Promise.resolve({
                    model: {
                        content: [10, 10, 110, 10, 110, 110, 10, 110], // 100x100 box at 10,10
                        width: 100,
                        height: 100
                    }
                });
            }
            return Promise.resolve({});
        });

        const success = await bridge.clickNode(123);
        
        expect(success).toBe(true);
        // Verify box model was requested
        expect(mockSendCommand).toHaveBeenCalledWith('DOM.getBoxModel', { backendNodeId: 123 });
        // Verify mouse events were sent (Press + Release)
        expect(mockSendCommand).toHaveBeenCalledWith('Input.dispatchMouseEvent', expect.objectContaining({
            type: 'mousePressed',
            x: 60, // Center of 10,10 100x100 is 60,60
            y: 60
        }));
        expect(mockSendCommand).toHaveBeenCalledWith('Input.dispatchMouseEvent', expect.objectContaining({
            type: 'mouseReleased',
            x: 60,
            y: 60
        }));
    });

    test('should fail click if box model missing', async () => {
        await bridge.attach(mockWebContents);
        mockSendCommand.mockRejectedValueOnce(new Error('Node not found'));
        
        const success = await bridge.clickNode(999);
        expect(success).toBe(false);
    });

    test('should type text with key events', async () => {
        await bridge.attach(mockWebContents);
        
        await bridge.typeText('hi', false); // Disable human delay for test speed

        // rawKeyDown for key press (no text insertion)
        expect(mockSendCommand).toHaveBeenCalledWith('Input.dispatchKeyEvent', expect.objectContaining({ type: 'rawKeyDown', key: 'h' }));
        // char event inserts the text
        expect(mockSendCommand).toHaveBeenCalledWith('Input.dispatchKeyEvent', expect.objectContaining({ type: 'char', text: 'h' }));
        expect(mockSendCommand).toHaveBeenCalledWith('Input.dispatchKeyEvent', expect.objectContaining({ type: 'keyUp', key: 'h' }));
        expect(mockSendCommand).toHaveBeenCalledWith('Input.dispatchKeyEvent', expect.objectContaining({ type: 'rawKeyDown', key: 'i' }));
        expect(mockSendCommand).toHaveBeenCalledWith('Input.dispatchKeyEvent', expect.objectContaining({ type: 'char', text: 'i' }));
        expect(mockSendCommand).toHaveBeenCalledWith('Input.dispatchKeyEvent', expect.objectContaining({ type: 'keyUp', key: 'i' }));
    });

    test('should use key events for control characters', async () => {
        await bridge.attach(mockWebContents);

        await bridge.typeText('\n', false);

        expect(mockSendCommand).toHaveBeenCalledWith('Input.dispatchKeyEvent', expect.objectContaining({
            type: 'rawKeyDown',
            key: 'Enter'
        }));
    });
});
