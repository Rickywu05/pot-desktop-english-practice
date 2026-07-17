import { readDir, BaseDirectory, readTextFile, exists } from '@tauri-apps/api/fs';
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';
import { appWindow, currentMonitor, PhysicalPosition, PhysicalSize } from '@tauri-apps/api/window';
import { appConfigDir, join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/tauri';
import { Spacer, Button, Tooltip } from '@nextui-org/react';
import { AiFillCloseCircle } from 'react-icons/ai';
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { listen } from '@tauri-apps/api/event';
import { BsPinFill } from 'react-icons/bs';
import { MdOutlineSchool } from 'react-icons/md';

import LanguageArea from './components/LanguageArea';
import SourceArea from './components/SourceArea';
import TargetArea from './components/TargetArea';
import PracticeArea from './components/PracticeArea';
import { osType } from '../../utils/env';
import { useConfig } from '../../hooks';
import { store } from '../../utils/store';
import { info } from 'tauri-plugin-log-api';
import {
    findRecoverableOpenAIServiceInstanceKeys,
    isPracticeTranslationService,
    resolvePracticeServiceInstance,
} from '../../services/translate/openai/service_instances';

let blurTimeout = null;
let resizeTimeout = null;
let moveTimeout = null;

const PRACTICE_PANEL_GAP = 8;
const PRACTICE_PANEL_HORIZONTAL_PADDING = 16;

const listenBlur = () => {
    return listen('tauri://blur', () => {
        if (appWindow.label === 'translate') {
            if (blurTimeout) {
                clearTimeout(blurTimeout);
            }
            info('Blur');
            // 100ms后关闭窗口，因为在 windows 下拖动窗口时会先切换成 blur 再立即切换成 focus
            // 如果直接关闭将导致窗口无法拖动
            blurTimeout = setTimeout(async () => {
                info('Confirm Blur');
                await appWindow.close();
            }, 100);
        }
    });
};

let unlisten = listenBlur();
// 取消 blur 监听
const unlistenBlur = () => {
    unlisten.then((f) => {
        f();
    });
};

// 监听 focus 事件取消 blurTimeout 时间之内的关闭窗口
void listen('tauri://focus', () => {
    info('Focus');
    if (blurTimeout) {
        info('Cancel Close');
        clearTimeout(blurTimeout);
    }
});
// 监听 move 事件取消 blurTimeout 时间之内的关闭窗口
void listen('tauri://move', () => {
    info('Move');
    if (blurTimeout) {
        info('Cancel Close');
        clearTimeout(blurTimeout);
    }
});

export default function Translate() {
    const { t } = useTranslation();
    const [closeOnBlur] = useConfig('translate_close_on_blur', true);
    const [alwaysOnTop] = useConfig('translate_always_on_top', false);
    const [windowPosition] = useConfig('translate_window_position', 'mouse');
    const [rememberWindowSize] = useConfig('translate_remember_window_size', false);
    const [translateServiceInstanceList, setTranslateServiceInstanceList] = useConfig('translate_service_list', [
        'deepl',
        'bing',
        'lingva',
        'yandex',
        'google',
        'ecdict',
    ]);
    const [recognizeServiceInstanceList] = useConfig('recognize_service_list', ['system', 'tesseract']);
    const [ttsServiceInstanceList] = useConfig('tts_service_list', ['lingva_tts']);
    const [collectionServiceInstanceList] = useConfig('collection_service_list', []);
    const [hideLanguage] = useConfig('hide_language', false);
    const [practiceServiceInstance] = useConfig('english_practice_service_instance', '');
    const [practiceVisible, setPracticeVisible] = useState(false);
    const [normalTranslatePanelWidth, setNormalTranslatePanelWidth] = useState(null);
    const [pined, setPined] = useState(false);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const [pluginList, setPluginList] = useState(null);
    const [serviceInstanceConfigMap, setServiceInstanceConfigMap] = useState(null);
    const practiceVisibleRef = useRef(false);
    const practiceResizeRef = useRef(false);
    const normalWindowBoundsRef = useRef(null);
    const translatePanelRef = useRef(null);
    const effectivePracticeServiceInstance = resolvePracticeServiceInstance(
        practiceServiceInstance,
        translateServiceInstanceList,
        serviceInstanceConfigMap
    );
    const reorder = (list, startIndex, endIndex) => {
        const result = Array.from(list);
        const [removed] = result.splice(startIndex, 1);
        result.splice(endIndex, 0, removed);
        return result;
    };

    const onDragEnd = async (result) => {
        if (!result.destination) return;
        const items = reorder(translateServiceInstanceList, result.source.index, result.destination.index);
        setTranslateServiceInstanceList(items);
    };
    // 是否自动关闭窗口
    useEffect(() => {
        if (closeOnBlur !== null && !closeOnBlur) {
            unlistenBlur();
        }
    }, [closeOnBlur]);
    // 是否默认置顶
    useEffect(() => {
        if (alwaysOnTop !== null && alwaysOnTop) {
            appWindow.setAlwaysOnTop(true);
            unlistenBlur();
            setPined(true);
        }
    }, [alwaysOnTop]);
    // 保存窗口位置
    useEffect(() => {
        if (windowPosition !== null && windowPosition === 'pre_state') {
            const unlistenMove = listen('tauri://move', async () => {
                if (moveTimeout) {
                    clearTimeout(moveTimeout);
                }
                moveTimeout = setTimeout(async () => {
                    if (appWindow.label === 'translate') {
                        let position = await appWindow.outerPosition();
                        const monitor = await currentMonitor();
                        const factor = monitor.scaleFactor;
                        position = position.toLogical(factor);
                        await store.set('translate_window_position_x', parseInt(position.x));
                        await store.set('translate_window_position_y', parseInt(position.y));
                        await store.save();
                    }
                }, 100);
            });
            return () => {
                unlistenMove.then((f) => {
                    f();
                });
            };
        }
    }, [windowPosition]);
    // 保存窗口大小
    useEffect(() => {
        if (rememberWindowSize !== null && rememberWindowSize) {
            const unlistenResize = listen('tauri://resize', async () => {
                if (resizeTimeout) {
                    clearTimeout(resizeTimeout);
                }
                resizeTimeout = setTimeout(async () => {
                    if (appWindow.label === 'translate' && !practiceVisibleRef.current) {
                        let size = await appWindow.outerSize();
                        const monitor = await currentMonitor();
                        const factor = monitor.scaleFactor;
                        size = size.toLogical(factor);
                        await store.set('translate_window_height', parseInt(size.height));
                        await store.set('translate_window_width', parseInt(size.width));
                        await store.save();
                    }
                }, 100);
            });
            return () => {
                unlistenResize.then((f) => {
                    f();
                });
            };
        }
    }, [rememberWindowSize]);

    const loadPluginList = async () => {
        const serviceTypeList = ['translate', 'tts', 'recognize', 'collection'];
        let temp = {};
        for (const serviceType of serviceTypeList) {
            temp[serviceType] = {};
            if (await exists(`plugins/${serviceType}`, { dir: BaseDirectory.AppConfig })) {
                const plugins = await readDir(`plugins/${serviceType}`, { dir: BaseDirectory.AppConfig });
                for (const plugin of plugins) {
                    const infoStr = await readTextFile(`plugins/${serviceType}/${plugin.name}/info.json`, {
                        dir: BaseDirectory.AppConfig,
                    });
                    let pluginInfo = JSON.parse(infoStr);
                    if ('icon' in pluginInfo) {
                        const appConfigDirPath = await appConfigDir();
                        const iconPath = await join(
                            appConfigDirPath,
                            `/plugins/${serviceType}/${plugin.name}/${pluginInfo.icon}`
                        );
                        pluginInfo.icon = convertFileSrc(iconPath);
                    }
                    temp[serviceType][plugin.name] = pluginInfo;
                }
            }
        }
        setPluginList({ ...temp });
    };

    useEffect(() => {
        loadPluginList();
        if (!unlisten) {
            unlisten = listen('reload_plugin_list', loadPluginList);
        }
    }, []);

    useEffect(() => {
        if (translateServiceInstanceList === null) return;

        let cancelled = false;
        const recoverConfiguredOpenAIServices = async () => {
            const entries = await store.entries();
            const recoverableKeys = findRecoverableOpenAIServiceInstanceKeys(entries, translateServiceInstanceList);
            if (cancelled || recoverableKeys.length === 0) return;

            await setTranslateServiceInstanceList([...translateServiceInstanceList, ...recoverableKeys], true);
        };

        void recoverConfiguredOpenAIServices();
        return () => {
            cancelled = true;
        };
    }, [translateServiceInstanceList, setTranslateServiceInstanceList]);

    const loadServiceInstanceConfigMap = async () => {
        const config = {};
        for (const serviceInstanceKey of translateServiceInstanceList) {
            config[serviceInstanceKey] = (await store.get(serviceInstanceKey)) ?? {};
        }
        for (const serviceInstanceKey of recognizeServiceInstanceList) {
            config[serviceInstanceKey] = (await store.get(serviceInstanceKey)) ?? {};
        }
        for (const serviceInstanceKey of ttsServiceInstanceList) {
            config[serviceInstanceKey] = (await store.get(serviceInstanceKey)) ?? {};
        }
        for (const serviceInstanceKey of collectionServiceInstanceList) {
            config[serviceInstanceKey] = (await store.get(serviceInstanceKey)) ?? {};
        }
        setServiceInstanceConfigMap({ ...config });
    };
    useEffect(() => {
        if (
            translateServiceInstanceList !== null &&
            recognizeServiceInstanceList !== null &&
            ttsServiceInstanceList !== null &&
            collectionServiceInstanceList !== null
        ) {
            loadServiceInstanceConfigMap();
        }
    }, [
        translateServiceInstanceList,
        recognizeServiceInstanceList,
        ttsServiceInstanceList,
        collectionServiceInstanceList,
    ]);

    useEffect(() => {
        if (translateServiceInstanceList === null) return;

        const unlistenPromises = translateServiceInstanceList.map((instanceKey) => {
            const eventKey = instanceKey.replaceAll('.', '_').replaceAll('@', ':');
            return listen(`${eventKey}_changed`, (event) => {
                setServiceInstanceConfigMap((currentMap) => {
                    if (currentMap === null) return currentMap;
                    return { ...currentMap, [instanceKey]: event.payload ?? {} };
                });
            });
        });

        return () => {
            for (const unlistenPromise of unlistenPromises) {
                void unlistenPromise.then((unlistenService) => unlistenService());
            }
        };
    }, [translateServiceInstanceList]);

    useEffect(() => {
        const updateWindowWidth = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', updateWindowWidth);
        return () => window.removeEventListener('resize', updateWindowWidth);
    }, []);

    const togglePracticeArea = async () => {
        if (practiceResizeRef.current) return;
        practiceResizeRef.current = true;

        try {
            const monitor = await currentMonitor();
            const factor = monitor.scaleFactor;
            const currentSize = await appWindow.outerSize();
            const currentPosition = await appWindow.outerPosition();

            if (!practiceVisibleRef.current) {
                const translatePanelWidth =
                    translatePanelRef.current?.getBoundingClientRect().width ?? window.innerWidth;
                setNormalTranslatePanelWidth(translatePanelWidth);
                normalWindowBoundsRef.current = {
                    width: currentSize.width,
                    height: currentSize.height,
                    x: currentPosition.x,
                    y: currentPosition.y,
                };

                const expandedWidth = Math.min(
                    currentSize.width + (translatePanelWidth + PRACTICE_PANEL_GAP) * factor,
                    monitor.size.width
                );
                const rightEdge = monitor.position.x + monitor.size.width;
                const expandedX = Math.max(monitor.position.x, Math.min(currentPosition.x, rightEdge - expandedWidth));

                if (expandedX !== currentPosition.x) {
                    await appWindow.setPosition(new PhysicalPosition(expandedX, currentPosition.y));
                }
                await appWindow.setSize(new PhysicalSize(expandedWidth, currentSize.height));
                practiceVisibleRef.current = true;
                setPracticeVisible(true);
            } else {
                const normalBounds = normalWindowBoundsRef.current;
                practiceVisibleRef.current = false;
                setPracticeVisible(false);

                if (normalBounds) {
                    await appWindow.setSize(new PhysicalSize(normalBounds.width, normalBounds.height));
                    await appWindow.setPosition(new PhysicalPosition(normalBounds.x, normalBounds.y));
                }
            }
        } catch (error) {
            info(`Failed to resize practice area: ${error}`);
            practiceVisibleRef.current = false;
            setPracticeVisible(false);
        } finally {
            practiceResizeRef.current = false;
        }
    };

    const requiredPracticeWidth =
        normalTranslatePanelWidth === null
            ? Number.POSITIVE_INFINITY
            : normalTranslatePanelWidth * 2 + PRACTICE_PANEL_GAP + PRACTICE_PANEL_HORIZONTAL_PADDING;
    const showPracticeArea = practiceVisible && windowWidth >= requiredPracticeWidth;

    return (
        pluginList && (
            <div
                className={`bg-background h-screen w-screen ${
                    osType === 'Linux' && 'rounded-[10px] border-1 border-default-100'
                }`}
            >
                <div
                    className='fixed top-[5px] left-[5px] right-[5px] h-[30px]'
                    data-tauri-drag-region='true'
                />
                <div className={`h-[35px] w-full flex ${osType === 'Darwin' ? 'justify-end' : 'justify-between'}`}>
                    <div className='flex'>
                        <Button
                            isIconOnly
                            size='sm'
                            variant='flat'
                            disableAnimation
                            className='my-auto bg-transparent'
                            onPress={() => {
                                if (pined) {
                                    if (closeOnBlur) {
                                        unlisten = listenBlur();
                                    }
                                    appWindow.setAlwaysOnTop(false);
                                } else {
                                    unlistenBlur();
                                    appWindow.setAlwaysOnTop(true);
                                }
                                setPined(!pined);
                            }}
                        >
                            <BsPinFill className={`text-[20px] ${pined ? 'text-primary' : 'text-default-400'}`} />
                        </Button>
                        <Tooltip content={practiceVisible ? t('english_practice.hide') : t('english_practice.show')}>
                            <Button
                                isIconOnly
                                size='sm'
                                variant='flat'
                                disableAnimation
                                className='my-auto bg-transparent'
                                onPress={() => void togglePracticeArea()}
                            >
                                <MdOutlineSchool
                                    className={`text-[20px] ${practiceVisible ? 'text-primary' : 'text-default-400'}`}
                                />
                            </Button>
                        </Tooltip>
                    </div>
                    <Button
                        isIconOnly
                        size='sm'
                        variant='flat'
                        disableAnimation
                        className={`my-auto ${osType === 'Darwin' && 'hidden'} bg-transparent`}
                        onPress={() => {
                            void appWindow.close();
                        }}
                    >
                        <AiFillCloseCircle className='text-[20px] text-default-400' />
                    </Button>
                </div>
                <div className={`${osType === 'Linux' ? 'h-[calc(100vh-37px)]' : 'h-[calc(100vh-35px)]'} px-[8px]`}>
                    <div className='flex h-full min-h-0 gap-2 overflow-hidden'>
                        <div
                            ref={translatePanelRef}
                            className={`${showPracticeArea ? 'shrink-0' : 'w-full'} min-w-0 overflow-y-auto`}
                            style={
                                showPracticeArea && normalTranslatePanelWidth !== null
                                    ? { width: `${normalTranslatePanelWidth}px` }
                                    : undefined
                            }
                        >
                            <div>
                                {serviceInstanceConfigMap !== null && (
                                    <SourceArea
                                        pluginList={pluginList}
                                        serviceInstanceConfigMap={serviceInstanceConfigMap}
                                    />
                                )}
                            </div>
                            <div className={`${hideLanguage && 'hidden'}`}>
                                <LanguageArea />
                                <Spacer y={2} />
                            </div>
                            <DragDropContext onDragEnd={onDragEnd}>
                                <Droppable
                                    droppableId='droppable'
                                    direction='vertical'
                                >
                                    {(provided) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                        >
                                            {translateServiceInstanceList !== null &&
                                                practiceServiceInstance !== null &&
                                                serviceInstanceConfigMap !== null &&
                                                translateServiceInstanceList.map((serviceInstanceKey, index) => {
                                                    const config = serviceInstanceConfigMap[serviceInstanceKey] ?? {};
                                                    const enable = config['enable'] ?? true;
                                                    const isPracticeService = isPracticeTranslationService(
                                                        serviceInstanceKey,
                                                        effectivePracticeServiceInstance
                                                    );

                                                    return enable && !isPracticeService ? (
                                                        <Draggable
                                                            key={serviceInstanceKey}
                                                            draggableId={serviceInstanceKey}
                                                            index={index}
                                                        >
                                                            {(provided) => (
                                                                <div
                                                                    ref={provided.innerRef}
                                                                    {...provided.draggableProps}
                                                                >
                                                                    <TargetArea
                                                                        {...provided.dragHandleProps}
                                                                        index={index}
                                                                        name={serviceInstanceKey}
                                                                        translateServiceInstanceList={
                                                                            translateServiceInstanceList
                                                                        }
                                                                        pluginList={pluginList}
                                                                        serviceInstanceConfigMap={
                                                                            serviceInstanceConfigMap
                                                                        }
                                                                    />
                                                                    <Spacer y={2} />
                                                                </div>
                                                            )}
                                                        </Draggable>
                                                    ) : (
                                                        <></>
                                                    );
                                                })}
                                        </div>
                                    )}
                                </Droppable>
                            </DragDropContext>
                        </div>
                        {serviceInstanceConfigMap !== null && (
                            <div
                                className={`${showPracticeArea ? '' : 'hidden'} h-full min-w-0 shrink-0 overflow-hidden`}
                                style={
                                    normalTranslatePanelWidth !== null
                                        ? { width: `${normalTranslatePanelWidth}px` }
                                        : undefined
                                }
                            >
                                <PracticeArea
                                    translateServiceInstanceList={translateServiceInstanceList}
                                    serviceInstanceConfigMap={serviceInstanceConfigMap}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    );
}
