import { merge } from 'lodash';

import { theme as flowbiteTheme } from 'flowbite-react/theme';

const customTheme = merge({}, flowbiteTheme, {
  button: {
    base: 'group relative flex items-center justify-center text-center !px-4 !py-2 text-center font-medium cursor-pointer',
    color: {
      primary: 'bg-primary text-white hover:bg-primaryemphasis',
      secondary: 'bg-secondary text-white',
      error: 'bg-error text-white',
      warning: 'bg-warning text-white',
      info: 'bg-info text-white hover:bg-primaryemphasis',
      success: 'bg-success text-white',
      muted: 'bg-muted text-dark dark:text-white dark:bg-darkmuted',
      lighterror: 'bg-lighterror dark:bg-darkerror text-error hover:bg-error hover:text-white',
      lightprimary: 'bg-lightprimary text-primary hover:bg-primary dark:hover:bg-primary hover:text-white',
      lightsecondary:
        'bg-lightsecondary dark:bg-darksecondary text-secondary hover:bg-secondary dark:hover:bg-secondary hover:text-white',
      lightsuccess:
        'bg-lightsuccess dark:bg-darksuccess text-success hover:bg-success dark:hover:bg-success hover:text-white',
      lightinfo: 'bg-lightinfo dark:bg-darkinfo text-info hover:bg-info dark:hover:bg-info hover:text-white',
      lightwarning:
        'bg-lightwarning dark:bg-darkwarning text-warning hover:bg-warning dark:hover:bg-warning hover:text-white',
      outlineprimary:
        'border border-primary bg-transparent text-primary hover:bg-primary dark:hover:bg-primary hover:text-white',
      outlinewhite: 'border border-white bg-transparent text-white hover:bg-white dark:hover:bg-white hover:text-dark',
      transparent: 'bg-transparent hover:bg-lightprimary dark:hover:bg-darkprimary hover:text-primary p-0',
    },
    inner: {
      base: 'flex items-center gap-2 transition-all duration-150 justify-center',
    },
  },

  drawer: {
    root: {
      base: 'fixed z-40 overflow-y-auto bg-white dark:bg-dark p-0 transition-transform',
      backdrop: 'fixed inset-0 z-30 bg-gray-900/50 dark:bg-gray-900/80',
      position: {
        top: {
          on: 'left-0 right-0 top-0 w-full transform-none',
          off: 'left-0 right-0 top-0 w-full -translate-y-full',
        },
        right: {
          on: 'right-0 top-0 h-screen w-80 transform-none',
          off: 'right-0 top-0 h-screen w-80 translate-x-full',
        },
        bottom: {
          on: 'bottom-0 left-0 right-0 w-full transform-none',
          off: 'bottom-0 left-0 right-0 w-full translate-y-full',
        },
        left: {
          on: 'left-0 top-0 h-screen w-80 transform-none',
          off: 'left-0 top-0 h-screen w-80 -translate-x-full',
        },
      },
    },
    header: {
      inner: {
        closeButton:
          'absolute end-2.5 top-3 flex h-8 w-8 items-center justify-center rounded-md bg-lightgray dark:bg-darkmuted text-primary',
        closeIcon: 'h-4 w-4',
        titleText: 'mb-4 inline-flex items-center text-base font-semibold text-darklink',
      },
    },
  },

  table: {
    root: {
      shadow: 'absolute left-0 top-0 -z-10 h-full w-full bg-transparent drop-shadow-md',
    },
    head: {
      base: 'group/head text-sm font-medium capitalize text-dark dark:text-white border-b border-ld',
      cell: {
        base: 'font-semibold px-4 py-4 dark:bg-transparent',
      },
    },
    body: {
      cell: {
        base: 'px-4 py-3 dark:bg-transparent',
      },
    },
    row: {
      hovered: 'bg-hover dark:bg-transparent',
      striped: 'odd:bg-transparent even:bg-gray-50 odd:dark:bg-dark even:dark:bg-gray-700',
    },
  },

  badge: {
    root: {
      base: 'flex h-fit w-fit items-center font-medium text-xs',
      color: {
        primary: 'bg-primary text-white',
        secondary: 'bg-secondary text-white',
        info: 'bg-info text-white',
        success: 'bg-success text-white',
        warning: 'bg-warning text-white',
        error: 'bg-error text-white',
        lightsuccess: 'bg-lightsuccess dark:bg-lightsuccess text-success',
        lightprimary: 'bg-lightprimary dark:bg-lightprimary text-primary',
        lightwarning: 'bg-lightwarning dark:bg-lightwarning text-warning',
        lightinfo: 'bg-lightinfo dark:bg-lightinfo text-info',
        lightsecondary: 'bg-lightsecondary dark:bg-lightsecondary text-secondary',
        lighterror: 'bg-lighterror dark:bg-lighterror text-error',
        white: 'bg-white dark:bg-darkmuted text-dark dark:text-white',
        muted: 'bg-muted dark:bg-darkmuted text-dark dark:text-white',
      },
    },
  },

  progress: {
    bar: 'space-x-2 rounded-full text-center font-medium leading-none text-cyan-300 dark:text-cyan-100',
    color: {
      success: 'bg-success',
      secondary: 'bg-secondary',
      warning: 'bg-warning',
      error: 'bg-error',
      info: 'bg-info',
      primary: 'bg-primary',
    },
  },

  sidebar: {
    root: {
      inner: 'bg-white dark:bg-dark rounded-none',
    },
    item: {
      base: 'flex items-center justify-center rounded-md px-4 py-3 mb-1 gap-3 text-[15px] text-start leading-[normal] font-normal text-link hover:text-primary dark:text-white dark:hover:text-primary',
      content: {
        base: 'flex-1 whitespace-nowrap px-0',
      },
      active: 'bg-lightprimary !text-primary dark:bg-lightprimary !dark:text-primary',
    },

    collapse: {
      button:
        'group flex gap-3 items-center rounded-md px-4 py-3 mb-1 text-[15px] text-start truncate leading-[normal] font-normal text-link hover:bg-lightprimary hover:text-primary dark:text-white w-full dark:hover:text-primary',
      icon: {
        base: 'h-6 w-6 text-link text-base',
      },
      label: {
        base: 'flex justify-start flex-1 max-w-36 overflow-hidden truncate',
      },
    },
    itemGroup: {
      base: 'mt-4 space-y-2 border-t border-ld pt-4 first:mt-0 first:border-t-0 first:pt-0 sidebar-nav',
    },
  },

  datepicker: {
    root: {
      input: {
        base: 'relative',
        field: {
          input: {
            base: 'block w-full border disabled:cursor-not-allowed disabled:opacity-50 bg-gray-50 border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500 pl-10 text-sm rounded-lg',
          },
          icon: {
            base: 'pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3',
            svg: 'h-4 w-4 text-gray-500 dark:text-gray-400',
          },
        },
      },
    },
    popup: {
      root: {
        base: 'absolute z-50 rounded-lg bg-white shadow-lg border border-gray-200 dark:bg-gray-800 dark:border-gray-700 right-0 lg:left-0 w-auto',
      },
    },
  },

  textInput: {
    field: {
      input: {
        base: 'block w-full border focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-50',
        sizes: {
          sm: 'p-2 sm:text-xs',
          md: 'p-2.5 text-sm',
          lg: 'p-4 sm:text-base',
        },
        colors: {
          gray: 'border-gray-300 bg-gray-50 text-gray-900 placeholder-gray-500 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-primary-500 dark:focus:ring-primary-500',
        },
      },
    },
  },

  checkbox: {
    base: 'h-4 w-4 rounded border-2 cursor-pointer bg-gray-100 dark:bg-gray-700 checked:bg-primary checked:border-primary',
    color: {
      default: 'border-gray-300 checked:bg-primary checked:border-primary',
      primary: 'border-gray-300 checked:bg-primary checked:border-primary',
      secondary: 'border-gray-300 checked:bg-secondary checked:border-secondary',
      error: 'border-gray-300 checked:bg-error checked:border-error',
    },
    indeterminate: 'bg-primary border-primary',
  },

  select: {
    field: {
      select: {
        base: 'block w-full appearance-none border bg-arrow-down-icon bg-[length:0.75em_0.75em] bg-[position:right_12px_center] bg-no-repeat pr-10 focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-50',
        sizes: {
          sm: 'p-2 sm:text-xs',
          md: 'p-2.5 text-sm',
          lg: 'p-4 sm:text-base',
        },
        colors: {
          gray: 'border-gray-300 bg-gray-50 text-gray-900 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-primary-500 dark:focus:ring-primary-500',
        },
      },
    },
  },

  toggleSwitch: {
    root: {
      base: 'group relative flex items-center',
      label: 'ml-3 text-sm font-medium text-gray-500 dark:text-gray-300',
    },
    toggle: {
      base: 'relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 outline-none transition-colors after:absolute after:left-[2px] after:h-5 after:w-5 after:translate-x-0 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[""] peer-checked:!bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:bg-gray-600 dark:peer-focus:ring-primary-800 dark:after:border-gray-600 dark:after:bg-gray-700',
      checked: {
        on: '!bg-primary after:translate-x-full after:border-white',
        off: 'bg-gray-200 after:translate-x-0 dark:bg-gray-600',
        color: {
          default: 'peer-checked:!bg-primary',
          primary: 'peer-checked:!bg-primary',
          success: 'peer-checked:bg-green-600',
          failure: 'peer-checked:bg-red-600',
          warning: 'peer-checked:bg-yellow-400',
          info: 'peer-checked:bg-cyan-600',
        },
      },
      sizes: {
        sm: 'h-4 w-7 after:h-3 after:w-3',
        md: 'h-5 w-9',
        lg: 'h-6 w-11 after:h-5 after:w-5',
      },
    },
  },
});

export default customTheme;
