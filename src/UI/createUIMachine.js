import { Machine, forwardTo } from 'xstate'

import createMainUIMachine from './createMainUIMachine'
import createLayersUIMachine from './createLayersUIMachine'

function createUIMachine(options, context) {
  const { main, layers } = options
  const mainMachine = createMainUIMachine(main, context)
  const layersMachine = createLayersUIMachine(layers, context)
  return Machine(
    {
      id: 'ui',
      initial: 'idle',
      context,
      states: {
        idle: {
          always: {
            target: 'active',
            actions: ['createInterface'],
          },
        },
        active: {
          type: 'parallel',
          invoke: [
            {
              id: 'main',
              src: mainMachine,
            },
            {
              id: 'layers',
              src: layersMachine,
            },
          ],
          on: {
            TOGGLE_BACKGROUND_COLOR: {
              actions: forwardTo('main'),
            },
            TOGGLE_DARK_MODE: {
              actions: 'applyContrastSensitiveStyle',
            },
            TOGGLE_FULLSCREEN: {
              actions: forwardTo('main'),
            },
            DISABLE_FULLSCREEN: {
              actions: forwardTo('main'),
            },
            TOGGLE_ROTATE: {
              actions: forwardTo('main'),
            },
            TOGGLE_ANNOTATIONS: {
              actions: forwardTo('main'),
            },
            TOGGLE_AXES: {
              actions: forwardTo('main'),
            },
            TOGGLE_INTERPOLATION: {
              actions: forwardTo('main'),
            },
            VIEW_MODE_CHANGED: {
              actions: forwardTo('main'),
            },
          },
          states: {
            // Optional feature of the user interface
            uiCollapsed: {
              initial: context.uiCollapsed ? 'enabled' : 'disabled',
              states: {
                enabled: {
                  entry: 'toggleUICollapsed',
                  on: {
                    TOGGLE_UI_COLLAPSED: 'disabled',
                  },
                },
                disabled: {
                  entry: 'toggleUICollapsed',
                  on: {
                    TOGGLE_UI_COLLAPSED: 'enabled',
                  },
                },
              },
            },
          },
        },
      },
    },
    options
  )
}

export default createUIMachine
