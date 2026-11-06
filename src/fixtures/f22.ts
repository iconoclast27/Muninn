// =============================================================================
// Muninn — F22: Search Host Mapping
// fixtures/f22-search-host.ts
//
// CONTRACT TEXT (sidebar UI):
//   PASS requires:
//     H1  createSearchHost forwards searchText to the API.
//     H2  createSearchHost forwards searchSemantic to the API.
//     H3  createSearchHost does not expose forceReindex (reindex lives in
//         settings, not the sidebar).
//     H4  createSearchHost.openFile resolves the path through the opener and
//         opens the returned TFile.
//     H5  createSearchHost.openFile does nothing when the path does not exist.
//     H6  search results from the host carry the frozen Hit shape.
//
// RUNNER: plain Node via tsx.
//   npx tsx src/fixtures/f22.ts
// =============================================================================

import { createSearchHost, type FileOpener } from '../ui/search-controller.ts';
import type { TAbstractFile } from 'obsidian';
import type { MuninnApi, Hit, TextSearchResult, SemanticSearchResult } from '../api.ts';

let failures = 0;
function check(name: string, cond: boolean, detail?: string): void {
    if (cond) {
        console.log(`  PASS  ${name}`);
    } else {
        failures++;
        console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    }
}

function fakeHit(path: string, ord: number): Hit {
    return { path, ord, bs: 0, be: 1, title: 'T', text: 'text' };
}

function fakeApi(opts: {
    textResult?: TextSearchResult | null;
    semanticResult?: SemanticSearchResult | null;
}): MuninnApi {
    return {
        searchText(query: string): TextSearchResult | null {
            if (opts.textResult === undefined) return null;
            return opts.textResult;
        },
        async searchSemantic(text: string): Promise<SemanticSearchResult | null> {
            if (opts.semanticResult === undefined) return null;
            return opts.semanticResult;
        },
        relatedChunks(): { neighbors: Hit[] } | null {
            return { neighbors: [] };
        },
        tagVocabulary(): { tags: { tag: string; files: number; chunks: number }[] } | null {
            return { tags: [] };
        },
        async forceReindex(): Promise<{ files: number; chunks: number; embedded: number; durationMs: number } | null> {
            return { files: 0, chunks: 0, embedded: 0, durationMs: 0 };
        },
    };
}

function fakeOpener(): { opener: FileOpener; opened: string[]; paths: Map<string, TAbstractFile> } {
    const opened: string[] = [];
    const paths = new Map<string, TAbstractFile>();
    paths.set('notes/exists.md', { extension: 'md' } as unknown as TAbstractFile);
    return {
        opener: {
            async openFile(file: TAbstractFile): Promise<void> {
                opened.push((file as unknown as { extension: string }).extension);
            },
            getAbstractFileByPath(path: string): TAbstractFile | null {
                return paths.get(path) ?? null;
            },
        },
        opened,
        paths,
    };
}

async function main(): Promise<void> {
    console.log('[F22] search host mapping');

    // H1
    const textHits = [fakeHit('notes/a.md', 0)];
    const api1 = fakeApi({ textResult: { hits: textHits, mode: 'bm25' } });
    const host1 = createSearchHost(api1, fakeOpener().opener);
    const h1 = host1.searchText('query');
    check('H1 forwards searchText', h1 !== null && h1.hits.length === 1 && h1.mode === 'bm25', JSON.stringify(h1));

    // H2
    const semanticHits = [fakeHit('notes/b.md', 1)];
    const api2 = fakeApi({ semanticResult: { hits: semanticHits } });
    const host2 = createSearchHost(api2, fakeOpener().opener);
    const h2 = await host2.searchSemantic('semantic query');
    check('H2 forwards searchSemantic', h2 !== null && h2.hits.length === 1, JSON.stringify(h2));

    // H3 — forceReindex was removed from the sidebar host
    check('H3 host has no forceReindex', !('forceReindex' in host1));

    // H4 / H5
    const opener = fakeOpener();
    const api4 = fakeApi({});
    const host4 = createSearchHost(api4, opener.opener);
    await host4.openFile('notes/exists.md');
    check('H4 opens existing path', opener.opened.length === 1, `${opener.opened.length}`);
    await host4.openFile('notes/missing.md');
    check('H5 ignores missing path', opener.opened.length === 1, `${opener.opened.length}`);

    // H6 — frozen shape sanity
    const h6 = host1.searchText('q');
    check('H6 result has frozen Hit shape',
        h6 !== null && h6.hits[0]?.path !== undefined && typeof h6.hits[0]?.ord === 'number',
        JSON.stringify(h6?.hits[0]));

    console.log(failures === 0
        ? '[F22] VERDICT: GREEN'
        : `[F22] VERDICT: RED — ${failures} failure(s)`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
