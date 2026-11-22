import { afterEach, describe, expect, it, vi } from 'vitest';

// as in the Android app: calendar links are loaded directly, without the Cloudflare worker
const nativeGetText = vi.fn();
vi.mock('../native/launcher', () => ({ isNative: true, nativeGetText: (url: string) => nativeGetText(url) }));

const { fetchIcs } = await import('./events');
const ICS = 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n';

afterEach(() => nativeGetText.mockReset());

describe('fetchIcs in the Android app', () => {
  it('loads the link directly, even without a worker address', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    nativeGetText.mockResolvedValue({ status: 200, text: ICS });
    expect(await fetchIcs({ url: '', key: '' }, 'webcal://calendar.google.com/n1.ics', true)).toBe(ICS);
    expect(nativeGetText).toHaveBeenCalledWith('https://calendar.google.com/n1.ics');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('reports server errors and non-calendar answers', async () => {
    nativeGetText.mockResolvedValueOnce({ status: 404, text: 'Not found' });
    await expect(fetchIcs({ url: '', key: '' }, 'https://calendar.google.com/n2.ics', true)).rejects.toThrow('Fehler 404');
    nativeGetText.mockResolvedValueOnce({ status: 200, text: '<html>' });
    await expect(fetchIcs({ url: '', key: '' }, 'https://calendar.google.com/n3.ics', true)).rejects.toThrow('keinen Kalender');
  });
});
