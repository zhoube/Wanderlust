import React from 'react';
import { Action, ActionProps } from './Action';
import {
    SpecificLocationProps,
    imgDirectoryGenerator,
} from './LocationComponent';
import {
    makeActionProps,
    makeDynamicActionProps,
    allPlayerActions,
} from '../../PlayerAction';
import DynamicAction, { DynamicActionProps } from './DynamicAction';
import { Locations } from 'wlcommon';

const Tuna = (props: SpecificLocationProps): React.ReactElement => {
    const { playerState, handleAction, triggerTooltip, isMentor, globalState } = props;

    const actions = allPlayerActions[Locations.locationIds.TUNA];

    const actionProps = makeActionProps(
        actions,
        isMentor,
        playerState,
        handleAction,
        triggerTooltip,
        globalState
    );

    const dynamicActionProps = makeDynamicActionProps(
        actions,
        isMentor,
        playerState,
        handleAction,
        triggerTooltip,
        globalState
    );

    return (
        <React.Fragment>
            <img src={imgDirectoryGenerator('tuna.png')} />
            {actionProps.map((info: ActionProps, index) => {
                return <Action key={index} {...info} />;
            })}
            {dynamicActionProps.map((info: DynamicActionProps, index) => {
                return <DynamicAction key={index} {...info} />;
            })}
        </React.Fragment>
    );
};

export default Tuna;
