import {
    Button,
    Card,
    CardBody,
    CardFooter,
    CardHeader,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownTrigger,
    Tooltip,
} from '@nextui-org/react';
import { writeText } from '@tauri-apps/api/clipboard';
import { useAtomValue } from 'jotai';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MdAutoFixHigh, MdContentCopy, MdKeyboardArrowDown } from 'react-icons/md';
import ReactMarkdown from 'react-markdown';

import { useConfig } from '../../../../hooks';
import { chatCompletions, isOpenAICompatibleConfig } from '../../../../services/openai_compatible';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../../utils/service_instance';
import { sourceDraftTextAtom } from '../SourceArea';
import { createLiteratureTranslationMessages } from './prompt';
import {
    canReuseLiteratureTranslation,
    createLiteratureTranslationRequestKey,
    isLiteratureTranslationStale,
} from './request_state';

function formatRequestError(error, t) {
    const status = error?.status;

    if (status === 401 || status === 403) return t('literature_translation.errors.auth');
    if (status === 402) return t('literature_translation.errors.balance');
    if (status === 404) return t('literature_translation.errors.address');
    if (status === 429) return t('literature_translation.errors.rate_limit');
    if (status === 400 || status === 422) {
        return `${t('literature_translation.errors.request')}\n\n${error.message}`;
    }

    return `${t('literature_translation.errors.network')}\n\n${error?.message || String(error)}`;
}

function hasAuthentication(config) {
    if (config.apiKey?.trim()) return true;
    return /"(?:authorization|api-key)"\s*:/i.test(config.customHeaders ?? '');
}

export default function LiteratureTranslationArea({ translateServiceInstanceList, serviceInstanceConfigMap }) {
    const { t } = useTranslation();
    const sourceText = useAtomValue(sourceDraftTextAtom);
    const [appFontSize] = useConfig('app_font_size', 16);
    const [selectedServiceInstance, setSelectedServiceInstance] = useConfig(
        'literature_translation_service_instance',
        ''
    );
    const [translation, setTranslation] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [lastCompletedKey, setLastCompletedKey] = useState('');
    const requestIdRef = useRef(0);

    const compatibleServices = useMemo(() => {
        return (translateServiceInstanceList ?? [])
            .map((instanceKey) => ({
                instanceKey,
                config: serviceInstanceConfigMap?.[instanceKey] ?? {},
            }))
            .filter(({ config }) => isOpenAICompatibleConfig(config));
    }, [translateServiceInstanceList, serviceInstanceConfigMap]);

    const selectedService = compatibleServices.find(({ instanceKey }) => instanceKey === selectedServiceInstance);

    useEffect(() => {
        if (selectedServiceInstance === null || compatibleServices.length === 0) return;
        if (selectedService) return;

        const defaultService =
            compatibleServices.find(({ config }) => config.enable !== false) ?? compatibleServices[0];
        setSelectedServiceInstance(defaultService.instanceKey);
    }, [compatibleServices, selectedService, selectedServiceInstance, setSelectedServiceInstance]);

    const currentRequestKey = createLiteratureTranslationRequestKey({
        documentText: sourceText,
        serviceInstance: selectedServiceInstance,
    });

    const translateLiterature = async () => {
        if (isLoading || !sourceText.trim()) return;
        if (!selectedService) {
            setError(t('literature_translation.no_service'));
            return;
        }
        if (!hasAuthentication(selectedService.config)) {
            setError(t('literature_translation.errors.no_key'));
            return;
        }

        const requestKey = createLiteratureTranslationRequestKey({
            documentText: sourceText,
            serviceInstance: selectedService.instanceKey,
        });
        if (canReuseLiteratureTranslation({ translation, lastCompletedKey, currentKey: requestKey })) {
            setError('');
            return;
        }

        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;
        setError('');
        setIsLoading(true);

        try {
            const messages = createLiteratureTranslationMessages(sourceText.trim());
            const result = await chatCompletions({
                config: selectedService.config,
                messages,
                onUpdate: (value) => {
                    if (requestIdRef.current === requestId) setTranslation(value);
                },
            });

            if (requestIdRef.current === requestId) {
                setTranslation(result);
                setLastCompletedKey(requestKey);
            }
        } catch (requestError) {
            if (requestIdRef.current === requestId) {
                setError(formatRequestError(requestError, t));
            }
        } finally {
            if (requestIdRef.current === requestId) setIsLoading(false);
        }
    };

    const selectedServiceName =
        selectedService?.config?.[INSTANCE_NAME_CONFIG_KEY] ||
        selectedService?.instanceKey ||
        t('literature_translation.select_service');
    const canTranslate = Boolean(sourceText.trim() && selectedService && !isLoading);
    const translationIsStale =
        !isLoading && isLiteratureTranslationStale({ translation, lastCompletedKey, currentKey: currentRequestKey });

    return (
        <Card
            shadow='none'
            className='rounded-[10px] bg-content1'
        >
            <CardHeader className='flex px-[12px] pb-0 pt-[9px] text-small font-medium'>
                <span>{t('literature_translation.title')}</span>
                {translationIsStale && (
                    <span className='ml-auto text-tiny font-normal text-warning'>
                        {t('literature_translation.stale')}
                    </span>
                )}
            </CardHeader>
            <CardBody className='max-h-[40vh] min-h-[100px] overflow-y-auto p-[12px]'>
                {error ? (
                    <div
                        className='whitespace-pre-wrap text-red-500'
                        style={{ fontSize: `${appFontSize}px` }}
                    >
                        {error}
                    </div>
                ) : translation ? (
                    <ReactMarkdown
                        className='practice-markdown select-text'
                        style={{ fontSize: `${appFontSize}px` }}
                    >
                        {translation}
                    </ReactMarkdown>
                ) : (
                    <p className='text-small text-default-400'>{t('literature_translation.empty')}</p>
                )}
            </CardBody>
            <CardFooter className='flex justify-between rounded-none rounded-b-[10px] bg-content1 px-[12px] p-[5px]'>
                <Dropdown>
                    <DropdownTrigger>
                        <Button
                            size='sm'
                            variant='light'
                            className='max-w-[55%] justify-start px-2 text-default-600'
                            endContent={<MdKeyboardArrowDown className='shrink-0 text-[16px]' />}
                        >
                            <span className='truncate'>{selectedServiceName}</span>
                        </Button>
                    </DropdownTrigger>
                    <DropdownMenu
                        aria-label={t('literature_translation.select_service')}
                        emptyContent={t('literature_translation.no_service')}
                        onAction={(key) => {
                            requestIdRef.current += 1;
                            setSelectedServiceInstance(String(key));
                            setIsLoading(false);
                            setError('');
                        }}
                    >
                        {compatibleServices.map(({ instanceKey, config }) => (
                            <DropdownItem key={instanceKey}>
                                {config[INSTANCE_NAME_CONFIG_KEY] || instanceKey}
                            </DropdownItem>
                        ))}
                    </DropdownMenu>
                </Dropdown>
                <div className='flex gap-1'>
                    <Tooltip content={t('translate.copy')}>
                        <Button
                            isIconOnly
                            variant='light'
                            size='sm'
                            isDisabled={!translation}
                            onPress={() => void writeText(translation)}
                        >
                            <MdContentCopy className='text-[16px]' />
                        </Button>
                    </Tooltip>
                    <Tooltip content={t('literature_translation.translate_hint')}>
                        <Button
                            size='sm'
                            color='primary'
                            variant='light'
                            isLoading={isLoading}
                            isDisabled={!canTranslate}
                            startContent={<MdAutoFixHigh className='text-[16px]' />}
                            onPress={() => void translateLiterature()}
                        >
                            {t('literature_translation.translate')}
                        </Button>
                    </Tooltip>
                </div>
            </CardFooter>
        </Card>
    );
}
