import React, { Component, PropTypes } from 'react';
import { createStylingFromTheme, base16Themes } from './utils/createStylingFromTheme';
import shouldPureComponentUpdate from 'react-pure-render/function';
import ActionList from './ActionList';
import ActionPreview from './ActionPreview';
import getInspectedState from './utils/getInspectedState';
import DiffPatcher from './DiffPatcher';
import { getBase16Theme } from 'react-base16-styling';
import { reducer, updateMonitorState } from './redux';
import { ActionCreators } from 'redux-devtools';

const { commit, sweep, toggleAction } = ActionCreators;

function getLastActionId(props) {
  return props.stagedActionIds[props.stagedActionIds.length - 1];
}

function getCurrentActionId(props, monitorState) {
  return monitorState.selectedActionId === null ?
    getLastActionId(props) : monitorState.selectedActionId;
}

function getFromState(actionIndex, stagedActionIds, computedStates, monitorState) {
  const { startActionId } = monitorState;
  if (startActionId === null) {
    return actionIndex > 0 ? computedStates[actionIndex - 1] : null;
  }
  let fromStateIdx = stagedActionIds.indexOf(startActionId - 1);
  if (fromStateIdx === -1) fromStateIdx = 0;
  return computedStates[fromStateIdx];
}

function createIntermediateState(props, monitorState) {
  const { supportImmutable, computedStates, stagedActionIds,
          actionsById: actions } = props;
  const { inspectedStatePath, inspectedActionPath } = monitorState;
  const currentActionId = getCurrentActionId(props, monitorState);
  const currentAction = actions[currentActionId] && actions[currentActionId].action;

  const actionIndex = stagedActionIds.indexOf(currentActionId);
  const fromState = getFromState(actionIndex, stagedActionIds, computedStates, monitorState);
  const toState = computedStates[actionIndex];
  const error = toState && toState.error;

  const fromInspectedState = !error && fromState &&
    getInspectedState(fromState.state, inspectedStatePath, supportImmutable);
  const toInspectedState =
    !error && toState && getInspectedState(toState.state, inspectedStatePath, supportImmutable);
  const delta = !error && fromState && toState && DiffPatcher.diff(
    fromInspectedState,
    toInspectedState
  );

  return {
    delta,
    nextState: toState && getInspectedState(toState.state, inspectedStatePath, false),
    action: getInspectedState(currentAction, inspectedActionPath, false),
    error
  };
}

function createThemeState(props) {
  const base16Theme = getBase16Theme(props.theme, base16Themes);
  const styling = createStylingFromTheme(props.theme, props.invertTheme);

  return { base16Theme, styling };
}

export default class DevtoolsInspector extends Component {
  constructor(props) {
    super(props);
    this.state = {
      ...createIntermediateState(props, props.monitorState),
      isWideLayout: false,
      themeState: createThemeState(props)
    };
  }

  static propTypes = {
    dispatch: PropTypes.func,
    computedStates: PropTypes.array,
    stagedActionIds: PropTypes.array,
    actionsById: PropTypes.object,
    currentStateIndex: PropTypes.number,
    monitorState: PropTypes.shape({
      initialScrollTop: PropTypes.number
    }),
    preserveScrollTop: PropTypes.bool,
    stagedActions: PropTypes.array,
    select: PropTypes.func.isRequired,
    theme: PropTypes.oneOfType([
      PropTypes.object,
      PropTypes.string
    ]),
    supportImmutable: PropTypes.bool
  };

  static update = reducer;

  static defaultProps = {
    select: (state) => state,
    supportImmutable: false,
    theme: 'inspector',
    invertTheme: true
  };

  shouldComponentUpdate = shouldPureComponentUpdate;

  componentDidMount() {
    this.updateSizeMode();
    this.updateSizeTimeout = window.setInterval(this.updateSizeMode.bind(this), 150);
  }

  componentWillUnmount() {
    window.clearTimeout(this.updateSizeTimeout);
  }

  updateMonitorState(monitorState) {
    this.props.dispatch(updateMonitorState(monitorState));
  }

  updateSizeMode() {
    const isWideLayout = this.refs.inspector.offsetWidth > 500;

    if (isWideLayout !== this.state.isWideLayout) {
      this.setState({ isWideLayout });
    }
  }

  componentWillReceiveProps(nextProps) {
    let nextMonitorState = nextProps.monitorState;
    const monitorState = this.props.monitorState;

    if (
      getCurrentActionId(this.props, monitorState) !==
      getCurrentActionId(nextProps, nextMonitorState) ||
      monitorState.startActionId !== nextMonitorState.startActionId ||
      monitorState.inspectedStatePath !== nextMonitorState.inspectedStatePath ||
      monitorState.inspectedActionPath !== nextMonitorState.inspectedActionPath
    ) {
      this.setState(createIntermediateState(nextProps, nextMonitorState));
    }

    if (this.props.theme !== nextProps.theme ||
        this.props.invertTheme !== nextProps.invertTheme) {
      this.setState({ themeState: createThemeState(nextProps) });
    }
  }

  render() {
    const { stagedActionIds: actionIds, actionsById: actions, computedStates,
      tabs, invertTheme, skippedActionIds, monitorState } = this.props;
    const { selectedActionId, startActionId, searchValue, tabName, subTabName } = monitorState;
    const inspectedPathType = tabName === 'Action' ? 'inspectedActionPath' : 'inspectedStatePath';
    const { themeState, isWideLayout, action, nextState, delta, error } = this.state;
    const { base16Theme, styling } = themeState;

    return (
      <div key='inspector'
           ref='inspector'
           {...styling(['inspector', isWideLayout && 'inspectorWide'], isWideLayout)}>
        <ActionList {...{
          actions, actionIds, isWideLayout, searchValue, selectedActionId, startActionId
        }}
                    styling={styling}
                    onSearch={this.handleSearch}
                    onSelect={this.handleSelectAction}
                    onToggleAction={this.handleToggleAction}
                    onCommit={this.handleCommit}
                    onSweep={this.handleSweep}
                    skippedActionIds={skippedActionIds}
                    lastActionId={getLastActionId(this.props)} />
        <ActionPreview {...{
          base16Theme, invertTheme, tabs, subTabName, tabName, delta, error, nextState,
          computedStates, action, actions, selectedActionId, startActionId
        }}
                       styling={styling}
                       onInspectPath={this.handleInspectPath.bind(this, inspectedPathType)}
                       inspectedPath={monitorState[inspectedPathType]}
                       onSelectTab={this.handleSelectTab}
                       onSelectSubTab={this.handleSelectSubTab}/>
      </div>
    );
  }

  handleToggleAction = actionId => {
    this.props.dispatch(toggleAction(actionId));
  };

  handleCommit = () => {
    this.props.dispatch(commit());
  };

  handleSweep = () => {
    this.props.dispatch(sweep());
  };

  handleSearch = val => {
    this.updateMonitorState({ searchValue: val });
  };

  handleSelectAction = (e, actionId) => {
    const { monitorState } = this.props;
    let startActionId;
    let selectedActionId;

    if (e.shiftKey && monitorState.selectedActionId !== null) {
      if (monitorState.startActionId !== null) {
        if (actionId >= monitorState.startActionId) {
          startActionId = Math.min(monitorState.startActionId, monitorState.selectedActionId);
          selectedActionId = actionId;
        } else {
          selectedActionId = Math.max(monitorState.startActionId, monitorState.selectedActionId);
          startActionId = actionId;
        }
      } else {
        startActionId = Math.min(actionId, monitorState.selectedActionId);
        selectedActionId = Math.max(actionId, monitorState.selectedActionId);
      }
    } else {
      startActionId = null;
      if (actionId === monitorState.selectedActionId || monitorState.startActionId !== null) {
        selectedActionId = null;
      } else {
        selectedActionId = actionId;
      }
    }

    this.updateMonitorState({ startActionId, selectedActionId });
  };

  handleInspectPath = (pathType, path) => {
    this.updateMonitorState({ [pathType]: path });
  };

  handleSelectTab = tabName => {
    this.updateMonitorState({ tabName });
  };

  handleSelectSubTab = subTabName => {
    this.updateMonitorState({ subTabName });
  };
}
