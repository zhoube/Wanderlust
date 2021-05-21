import React from 'react';
import TopBar from './TopBar/TopBar';
import Location from './Location/Location';
import BottomBar from './BottomBar/BottomBar';
import Journal from './Journal/Journal';
import { Actions } from 'wlcommon';
import './Game.css';
import { socket } from '../socket/socket';

export interface GameProps {
    groupId: string;
}

/*
    Organization of components:
        TopBar
            - Inventory
            - TopRightHUD
        Location
            - Background
            - Actions
            - Location bar
        BottomBar
            - Notifications
            - Quests
        Journal
            - Tabs
            - Contents {Journal, Notes, Oxygen}
        Popup?
            - Various popup windows
*/

const Game = (props: GameProps): React.ReactElement => {
    const { groupId } = props;
    const [ playerState, setPlayerState ] = React.useState(undefined);
    const [ globalState, setGlobalState ] = React.useState(undefined);
    
    //gamestate processing and listening
    React.useEffect(() => {
        socket.on('player_update', (newGameState: React.SetStateAction<undefined>) => {
            console.log(newGameState);
            setPlayerState(newGameState) 
        });
        socket.on('global_update', (newGameState: React.SetStateAction<undefined>) => {
            console.log(newGameState);
            setGlobalState(newGameState)
        });
    }, []);

    const handleAction = (action: string) => {
        console.log(action);
        socket.emit("action", action, (
            eventType: string,
            payload: string | Record<string, unknown>
        ) => {
            if (eventType == "error") {
                console.log("Error: " + payload);
            } else if (eventType == "info") {
                console.log("Info: " + payload);
            }
        });
    }
    
    return (
        <div className="game">
            <TopBar inventory={["potato"]} oxygenLeft={100} oxygenRate={100} crimsonTime="temp" />
            <Location />
            <BottomBar />
            <Journal />
        </div>
    );
};

export default Game;
            