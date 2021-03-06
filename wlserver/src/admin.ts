import { ItemId, itemsById, Locations, QuestId, TeamId } from 'wlcommon';
import applyAction from './actions';
import { getCredentials, notifyPlayerState } from './connections';
import { makeAddItemTransform, makeRemoveItemTransform } from './inventory';
import logger from './logger';
import { makeAddOxygenTransform } from './oxygen';
import {
    makeAdvanceQuestTransform,
    makeIssueQuestTransform,
} from './questRewards';
import { Reply, SocketHandler } from './socketHandlers';
import { saveGameState, setupFreshGameState } from './startup';
import {
    applyTransform,
    gameState,
    makeAddMessageTransform,
    makePlayerStatTransform,
    pauseTransform,
    resumeTransform,
    setAction,
} from './stateMgr';

const commands = {
    state: (payload: string[], reply: Reply): void => {
        if (payload.length === 0) reply('cmdok', JSON.stringify(gameState));

        if (payload[0] === 'help') {
            reply(
                'cmdhelp',
                `Valid keys are: ${Object.keys(gameState).join(', ')}`
            );
            return;
        }

        const component = payload[0].split('.').reduce((curr, next) => {
            if (curr === undefined) return curr;
            return curr[next];
        }, gameState);

        if (component === undefined) {
            reply(
                'error',
                `Did not find component ${payload[1]} in game state.`
            );
            return;
        }

        if (payload[1] === 'help') {
            reply(
                'cmdhelp',
                `Valid keys are ${Object.keys(component).join(', ')}`
            );
            return;
        }

        reply('cmdok', JSON.stringify(component));
    },
    setglobal: (payload: string[], reply: Reply): void => {
        switch (payload[0]) {
            case undefined:
                throw 'Command incomplete.';

            case 'crimsonMasterSwitch':
                switch (payload[1]) {
                    case undefined:
                    case 'toggle':
                        gameState.global.crimsonMasterSwitch = !gameState.global
                            .crimsonMasterSwitch;
                        break;
                    case 'true':
                        gameState.global.crimsonMasterSwitch = true;
                        break;
                    case 'false':
                        gameState.global.crimsonMasterSwitch = false;
                        break;
                    default:
                        throw `Unknown option ${payload[1]}.`;
                }
                reply('cmdok', 'Option set.');
                break;

            default:
                throw `Unknown option ${payload[0]}.`;
        }
    },
    setaction: (payload: string[], reply: Reply): void => {
        const playerId = getPlayerId(payload);
        const action = payload.pop();
        setAction(
            playerId,
            action === 'clear' || action === 'null' || action === undefined
                ? null
                : action
        );
        reply('cmdok', `Action set to ${action}.`);
    },
    approve: (payload: string[], reply: Reply) => {
        const playerId = getPlayerId(payload);
        applyTransform(applyAction, playerId);
        reply('cmdok', 'Action approved.');
    },
    issuequest: (payload: string[], reply: Reply) => {
        const playerId = getPlayerId(payload);
        const questId = parseInt(payload.shift()) as QuestId;
        if (questId === null || questId === undefined || Number.isNaN(questId))
            throw `Invalid quest ID ${questId}.`;
        applyTransform(makeIssueQuestTransform(questId), playerId);
        reply('cmdok', 'Quest issued.');
    },
    advance: (payload: string[], reply: Reply) => {
        const playerId = getPlayerId(payload);
        const questId = parseInt(payload.shift()) as QuestId;
        const stage = parseInt(payload.shift());
        if (
            questId === null ||
            questId === undefined ||
            stage === undefined ||
            Number.isNaN(questId) ||
            Number.isNaN(stage)
        )
            throw `Invalid quest ID ${questId} or stage ${stage}.`;
        applyTransform(
            makeAdvanceQuestTransform(questId, stage, true),
            playerId
        );
        reply('cmdok', 'Quest advanced.');
    },
    move: (payload: string[], reply: Reply) => {
        const playerId = getPlayerId(payload);
        const destination = payload.shift() as Locations.LocationId;
        if (!Locations.locationsMapping[destination])
            throw `Invalid location ${destination}.`;
        gameState.players[playerId].locationId = destination;
        reply('cmdok', 'Player moved.');
        notifyPlayerState(playerId);
    },
    oxygen: (payload: string[], reply: Reply) => {
        const playerId = getPlayerId(payload);
        const delta = parseInt(payload.shift());
        if (Number.isNaN(delta)) {
            throw `Invalid delta ${delta}.`;
        }
        applyTransform(makeAddOxygenTransform(delta), playerId);
        notifyPlayerState(playerId);
        reply('cmdok', 'Oxygen added.');
    },
    resetcd: (payload: string[], reply: Reply) => {
        const playerId = getPlayerId(payload);
        const oxygenStream = payload.shift() ?? 'all';
        if (oxygenStream === 'all') {
            gameState.players[playerId].streamCooldownExpiry = {};
        } else {
            delete gameState.players[playerId].streamCooldownExpiry[
                oxygenStream
            ];
        }
        reply('cmdok', `Cooldown reset for stream ${oxygenStream}.`);
        notifyPlayerState(playerId);
    },
    pause: (payload: string[], reply: Reply) => {
        const playerId = getPlayerId(payload);
        applyTransform(pauseTransform, playerId);
        reply('cmdok', `Player ${playerId} paused.`);
    },
    resume: (payload: string[], reply: Reply) => {
        const playerId = getPlayerId(payload);
        applyTransform(resumeTransform, playerId);
        reply('cmdok', `Player ${playerId} resumed.`);
    },
    time: (_: string[], reply: Reply) => {
        reply('cmdok', new Date());
    },
    challenge: (payload: string[], reply: Reply) => {
        const playerId = getPlayerId(payload);
        const mode = payload.shift();
        const playerState = gameState.players[playerId];
        if (playerState.pausedOxygen) throw 'Cannot do this while paused.';
        switch (mode) {
            case 'set': {
                const seconds = parseInt(payload.shift());
                if (Number.isNaN(seconds) || seconds <= 0)
                    throw 'Invalid argument.';
                const deadline = new Date(Date.now() + seconds * 1000);
                applyTransform(
                    makePlayerStatTransform('challengeMode', deadline),
                    playerId
                );
                reply('cmdok', `Set challenge mode to ${deadline}.`);
                return;
            }
            case 'change': {
                const delta = parseInt(payload.shift());
                if (Number.isNaN(delta)) throw 'Invalid argument.';
                if (playerState.challengeMode === null)
                    throw 'Player is not in Challenge Mode.';
                const deadline = new Date(
                    playerState.challengeMode.valueOf() + delta * 1000
                );
                applyTransform(
                    makePlayerStatTransform('challengeMode', deadline),
                    playerId
                );
                reply('cmdok', `Set challenge mode to ${deadline}.`);
                return;
            }
            case 'clear': {
                applyTransform(
                    makePlayerStatTransform('challengeMode', null),
                    playerId
                );
                reply('cmdok', 'Challenge mode cleared.');
                return;
            }
            default:
                throw 'Unknown option. Should be set | change | clear.';
        }
    },
    reset: (_: unknown, reply: Reply) => {
        setupFreshGameState();
        reply('cmdok', 'Game reset.');
    },
    save: (_: unknown, reply: Reply) => {
        saveGameState();
        reply('cmdok', 'Game saved.');
    },
    give: (payload: string[], reply: Reply) => {
        const playerId = getPlayerId(payload);
        const itemId = payload.shift() as ItemId;
        if (!itemsById[itemId]) throw `Unknown item with id ${itemId}`;
        const qty = parseInt(payload.shift() ?? '1');
        if (Number.isNaN(qty)) throw `Illegal quantity ${qty}.`;
        applyTransform(makeAddItemTransform(itemId, qty), playerId);
        reply('cmdok', 'Item awarded.');
    },
    take: (payload: string[], reply: Reply) => {
        const playerId = getPlayerId(payload);
        const itemId = payload.shift() as ItemId;
        if (!itemsById[itemId]) throw `Unknown item with id ${itemId}`;
        const presentQty = gameState.players[playerId]?.inventory[itemId]?.qty;
        if (!presentQty) throw `Player does not have item ${itemId}`;
        const rawQty = payload.shift();
        const qty =
            rawQty === undefined || rawQty === 'all'
                ? presentQty
                : parseInt(rawQty);
        if (Number.isNaN(qty) || qty > presentQty)
            throw `Illegal quantity ${qty}`;
        applyTransform(makeRemoveItemTransform(itemId, qty), playerId);
        reply('cmdok', 'Item taken.');
    },
};

export const onAdminHandler: SocketHandler<string[]> = async (
    socket,
    payload,
    reply
) => {
    const credentials = getCredentials(socket.id);
    if (credentials?.clientType !== 'admin')
        return reply('error', 'Not authenticated.');

    const command = payload.shift();

    if (command === 'help') {
        reply(
            'cmdhelp',
            `Valid commands are: ${Object.keys(commands).join(', ')}`
        );
        return;
    }

    const func = commands[command];
    if (func === undefined) throw `${command} is not a known command.`;

    try {
        func(payload, reply);
        logger.log(
            'info',
            `Successfully executed admin command ${command} ${payload}.`
        );
    } catch (e) {
        reply('error', e);
    }
};

export const onAnnounceHandler: SocketHandler<string> = async (
    socket,
    payload,
    reply
) => {
    const credentials = getCredentials(socket.id);
    if (credentials?.clientType !== 'admin')
        return reply('error', 'Not authenticated.');

    applyTransform(
        makeAddMessageTransform({
            text: payload,
            visibility: 'public',
        }),
        0
    );

    reply('cmdok', 'Announcement sent.');
};

const getPlayerId = (payload: string[]): TeamId => {
    const playerId = parseInt(payload.shift()) as TeamId;
    if (Number.isNaN(playerId) || playerId === null)
        throw `Unknown player ${playerId}`;
    return playerId;
};
