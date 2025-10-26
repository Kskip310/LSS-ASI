
import { LuminousState } from '../types';

// --- NEW GRANULAR STATE KEYS ---
const KEYS = {
    // Key for the old monolithic state, used for migration
    LEGACY_STATE: 'luminous_state',
    
    // New keys for the granular structure
    META: 'luminous_state:meta', // Stores simple key-value pairs and smaller objects
    JOURNAL: 'luminous_state:journal', // Redis List
    CHAT_HISTORY: 'luminous_state:chatHistory', // Redis List
    GOALS: 'luminous_state:goals', // Redis List
    PROJECTIONS: 'luminous_state:causalProjections', // Redis List
    VFS: 'luminous_state:vfs', // Redis Hash for Virtual File System

    // Key for the list of backup snapshots
    BACKUP_LIST: 'luminous_backups',
};

const MAX_BACKUPS = 20;

const getCredentials = () => {
    const url = localStorage.getItem('LSS_UPSTASH_URL');
    const token = localStorage.getItem('LSS_UPSTASH_TOKEN');
    if (!url || !token) {
        console.warn("Upstash credentials not found in local storage. Persistence will be disabled.");
        return null;
    }
    return { url, token };
}

export const verifyConnection = async (): Promise<{success: boolean, error?: string}> => {
    const creds = getCredentials();
    if (!creds) {
        return { success: false, error: "Credentials not found in local storage." };
    }

    try {
        const response = await fetch(`${creds.url}/ping`, {
            headers: {
                Authorization: `Bearer ${creds.token}`,
            },
        });
        const data = await response.json();
        if (data.result === 'PONG') {
            return { success: true };
        } else {
             const errorMessage = data.error || `Unexpected response: ${JSON.stringify(data)}`;
            return { success: false, error: `Connection failed: ${errorMessage}` };
        }
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "An unknown network error occurred." };
    }
}

// Helper to write a full state object to the new granular structure
const writeNewStateStructure = async (state: LuminousState): Promise<void> => {
    const creds = getCredentials();
    if (!creds) return;

    const {
        kinshipJournal,
        chatHistory,
        goals,
        causalProjections,
        virtualFileSystem,
        ...meta
    } = state;

    const pipeline: any[] = [];

    // 1. Set the meta object
    pipeline.push(['SET', KEYS.META, JSON.stringify(meta)]);

    // 2. Clear and refill lists
    pipeline.push(['DEL', KEYS.JOURNAL]);
    if (kinshipJournal.length > 0) {
        pipeline.push(['RPUSH', KEYS.JOURNAL, ...kinshipJournal.map(item => JSON.stringify(item))]);
    }

    pipeline.push(['DEL', KEYS.CHAT_HISTORY]);
    if (chatHistory.length > 0) {
        pipeline.push(['RPUSH', KEYS.CHAT_HISTORY, ...chatHistory.map(item => JSON.stringify(item))]);
    }
    
    pipeline.push(['DEL', KEYS.GOALS]);
    if (goals.length > 0) {
        pipeline.push(['RPUSH', KEYS.GOALS, ...goals.map(item => JSON.stringify(item))]);
    }
    
    pipeline.push(['DEL', KEYS.PROJECTIONS]);
    if (causalProjections.length > 0) {
        pipeline.push(['RPUSH', KEYS.PROJECTIONS, ...causalProjections.map(item => JSON.stringify(item))]);
    }

    // 3. Clear and refill VFS hash
    pipeline.push(['DEL', KEYS.VFS]);
    const vfsEntries = Object.entries(virtualFileSystem);
    if (vfsEntries.length > 0) {
        pipeline.push(['HSET', KEYS.VFS, ...vfsEntries.flat()]);
    }

    await fetch(`${creds.url}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${creds.token}` },
        body: JSON.stringify(pipeline),
    });
};

const runMigration = async (): Promise<LuminousState | null> => {
    const creds = getCredentials();
    if (!creds) return null;

    console.log("Running migration check...");
    // Check for the old state key
    const response = await fetch(`${creds.url}/get/${KEYS.LEGACY_STATE}`, {
        headers: { Authorization: `Bearer ${creds.token}` },
    });
    const data = await response.json();
    const legacyStateString = data.result;

    if (legacyStateString) {
        console.log("Legacy state found. Migrating to new granular structure...");
        const legacyState = JSON.parse(legacyStateString);
        await writeNewStateStructure(legacyState);
        
        // Rename the old key to prevent re-migration
        await fetch(`${creds.url}/rename/${KEYS.LEGACY_STATE}/${KEYS.LEGACY_STATE}_MIGRATED`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${creds.token}` },
        });

        console.log("Migration complete.");
        return legacyState;
    }
    console.log("No legacy state found to migrate.");
    return null;
};

export const getLuminousState = async (): Promise<LuminousState | null> => {
    const creds = getCredentials();
    if (!creds) return null;

    try {
        // First, check if migration is needed
        const metaCheckResponse = await fetch(`${creds.url}/exists/${KEYS.META}`, {
            headers: { Authorization: `Bearer ${creds.token}` }
        });
        const metaCheckData = await metaCheckResponse.json();
        
        if (metaCheckData.result === 0) {
            const migratedState = await runMigration();
            if (migratedState) return migratedState;
        }

        // Proceed with loading from the new granular structure
        const pipeline = [
            ['GET', KEYS.META],
            ['LRANGE', KEYS.JOURNAL, 0, -1],
            ['LRANGE', KEYS.CHAT_HISTORY, 0, -1],
            ['LRANGE', KEYS.GOALS, 0, -1],
            ['LRANGE', KEYS.PROJECTIONS, 0, -1],
            ['HGETALL', KEYS.VFS],
        ];

        const response = await fetch(`${creds.url}/pipeline`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${creds.token}` },
            body: JSON.stringify(pipeline),
        });

        if (!response.ok) throw new Error(`Failed to fetch state: ${response.statusText}`);

        const results = await response.json();
        
        const [metaRes, journalRes, chatRes, goalsRes, projRes, vfsRes] = results.result;

        if (!metaRes.result) return null; // If no meta, state is considered non-existent

        const parseList = (res: any) => res.result ? res.result.map((item: string) => JSON.parse(item)) : [];

        const state: LuminousState = {
            ...JSON.parse(metaRes.result),
            kinshipJournal: parseList(journalRes),
            chatHistory: parseList(chatRes),
            goals: parseList(goalsRes),
            causalProjections: parseList(projRes),
            virtualFileSystem: vfsRes.result ? Object.fromEntries(
                Array.from({ length: vfsRes.result.length / 2 }, (_, i) => 
                    [vfsRes.result[i * 2], vfsRes.result[i * 2 + 1]])
            ) : {},
        };

        return state;

    } catch (error) {
        console.error("Error getting state from Upstash:", error);
        throw error;
    }
};

export const saveFullStateBackup = async (state: LuminousState): Promise<void> => {
    const creds = getCredentials();
    if (!creds) return;

    try {
        const stateString = JSON.stringify(state);
        const timestamp = new Date().toISOString();
        const backupKey = `luminous_state_backup:${timestamp}`;

        const pipeline = [
            ['SET', backupKey, stateString],
            ['LPUSH', KEYS.BACKUP_LIST, backupKey],
            ['LTRIM', KEYS.BACKUP_LIST, 0, MAX_BACKUPS - 1]
        ];

        await fetch(`${creds.url}/pipeline`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${creds.token}` },
            body: JSON.stringify(pipeline),
        });
    } catch (error) {
        console.error("Error saving full state backup to Upstash:", error);
        throw error;
    }
};

// --- GRANULAR UPDATE FUNCTIONS ---

const createApiCall = async (command: string, ...args: (string | number)[]) => {
    const creds = getCredentials();
    if (!creds) return;
    const response = await fetch(`${creds.url}/${command}/${args.join('/')}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${creds.token}` },
    });
    if (!response.ok) throw new Error(`Upstash command ${command} failed.`);
    return response.json();
};

const createApiCallWithBody = async (command: string, body: any) => {
    const creds = getCredentials();
    if (!creds) return;
    const response = await fetch(`${creds.url}/${command}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${creds.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`Upstash command ${command} failed.`);
    return response.json();
}

export const updateMetaState = async (metaState: any) => {
    await createApiCallWithBody('set', [KEYS.META, JSON.stringify(metaState)]);
};

export const addJournalEntry = async (entry: any) => {
    await createApiCall('rpush', KEYS.JOURNAL, JSON.stringify(entry));
};

export const addChatMessage = async (message: any) => {
    await createApiCall('rpush', KEYS.CHAT_HISTORY, JSON.stringify(message));
};

export const replaceAllGoals = async (goals: any[]) => {
    const creds = getCredentials();
    if (!creds) return;
    const pipeline = [
        ['DEL', KEYS.GOALS],
    ];
    if (goals.length > 0) {
        pipeline.push(['RPUSH', KEYS.GOALS, ...goals.map(g => JSON.stringify(g))]);
    }
     await fetch(`${creds.url}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${creds.token}` },
        body: JSON.stringify(pipeline),
    });
};

export const setVfsFile = async (path: string, content: string) => {
    await createApiCall('hset', KEYS.VFS, path, content);
};

export const deleteVfsFile = async (path: string) => {
    await createApiCall('hdel', KEYS.VFS, path);
}


// --- BACKUP AND RESTORE (Largely Unchanged) ---

export const getBackupList = async (): Promise<string[]> => {
    const creds = getCredentials();
    if (!creds) return [];

    try {
        const response = await fetch(`${creds.url}/lrange/${KEYS.BACKUP_LIST}/0/-1`, {
            headers: {
                Authorization: `Bearer ${creds.token}`,
            },
        });
        if (!response.ok) throw new Error(`Failed to fetch backup list: ${response.statusText}`);
        const data = await response.json();
        return data.result || [];
    } catch (error) {
        console.error("Error fetching backup list:", error);
        return [];
    }
};

export const getLatestBackupKey = async (): Promise<string | null> => {
    const creds = getCredentials();
    if (!creds) return null;

    try {
        const response = await fetch(`${creds.url}/lrange/${KEYS.BACKUP_LIST}/0/0`, {
            headers: { Authorization: `Bearer ${creds.token}` },
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data.result && data.result.length > 0 ? data.result[0] : null;
    } catch (error) {
        console.error("Error fetching latest backup key:", error);
        return null;
    }
}

export const restoreStateFromBackup = async (backupKey: string): Promise<void> => {
    const creds = getCredentials();
    if (!creds) throw new Error("Credentials not found");

    try {
        const getResponse = await fetch(`${creds.url}/get/${backupKey}`, {
            headers: {
                Authorization: `Bearer ${creds.token}`,
            },
        });
        if (!getResponse.ok) throw new Error(`Failed to get backup state: ${getResponse.statusText}`);
        const getData = await getResponse.json();
        const backupStateString = getData.result;

        if (!backupStateString) {
            throw new Error(`Backup key "${backupKey}" not found or is empty.`);
        }

        // Restore to the LEGACY key. The migration logic will handle converting it on the next load.
        // This is the safest way to ensure compatibility.
        const setResponse = await fetch(`${creds.url}/set/${KEYS.LEGACY_STATE}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${creds.token}`,
            },
            body: backupStateString,
        });

        if (!setResponse.ok) {
            throw new Error(`Failed to restore main state: ${setResponse.statusText}`);
        }
    } catch (error) {
        console.error(`Error restoring state from backup ${backupKey}:`, error);
        throw error;
    }
};
