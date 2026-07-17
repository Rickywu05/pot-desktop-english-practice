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
import { createEnglishPracticeMessages } from './prompt';
import { canReusePracticeFeedback, createPracticeRequestKey, isPracticeFeedbackStale } from './request_state';

function formatRequestError(error, t) {
    const status = error?.status;

    if (status === 401 || status === 403) return t('english_practice.errors.auth');
    if (status === 402) return t('english_practice.errors.balance');
    if (status === 404) return t('english_practice.errors.address');
    if (status === 429) return t('english_practice.errors.rate_limit');
    if (status === 400 || status === 422) {
        return `${t('english_practice.errors.request')}\n\n${error.message}`;
    }

    return `${t('english_practice.errors.network')}\n\n${error?.message || String(error)}`;
}

function hasAuthentication(config) {
    if (config.apiKey?.trim()) return true;
    return /"(?:authorization|api-key)"\s*:/i.test(config.customHeaders ?? '');
}

export default function PracticeArea({ translateServiceInstanceList, serviceInstanceConfigMap }) {
    const { t } = useTranslation();
    const sourceText = useAtomValue(sourceDraftTextAtom);
    const [appFontSize] = useConfig('app_font_size', 16);
    const [selectedServiceInstance, setSelectedServiceInstance] = useConfig('english_practice_service_instance', '');
    const [userText, setUserText] = useState('');
    const [feedback, setFeedback] = useState('');
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

    const currentRequestKey = createPracticeRequestKey({
        sourceText,
        userText,
        serviceInstance: selectedServiceInstance,
    });

    const checkEnglish = async () => {
        if (isLoading || !sourceText.trim() || !userText.trim()) return;
        if (!selectedService) {
            setError(t('english_practice.no_service'));
            return;
        }
        if (!hasAuthentication(selectedService.config)) {
            setError(t('english_practice.errors.no_key'));
            return;
        }

        const requestKey = createPracticeRequestKey({
            sourceText,
            userText,
            serviceInstance: selectedService.instanceKey,
        });
        if (canReusePracticeFeedback({ feedback, lastCompletedKey, currentKey: requestKey })) {
            setError('');
            return;
        }

        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;
        setError('');
        setIsLoading(true);

        try {
            const messages = createEnglishPracticeMessages(sourceText.trim(), userText.trim());
            const result = await chatCompletions({
                config: selectedService.config,
                messages,
                onUpdate: (value) => {
                    if (requestIdRef.current === requestId) setFeedback(value);
                },
            });

            if (requestIdRef.current === requestId) {
                setFeedback(result);
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
        t('english_practice.select_service');
    const canCheck = Boolean(sourceText.trim() && userText.trim() && selectedService && !isLoading);
    const feedbackIsStale =
        !isLoading && isPracticeFeedbackStale({ feedback, lastCompletedKey, currentKey: currentRequestKey });

    return (
        <div className='flex h-full min-h-0 flex-col gap-2'>
            <Card
                shadow='none'
                className='min-h-[150px] flex-[2] bg-content1 rounded-[10px]'
            >
                <CardHeader className='px-[12px] pb-0 pt-[9px] text-small font-medium'>
                    {t('english_practice.input_title')}
                </CardHeader>
                <CardBody className='min-h-0 overflow-y-auto bg-content1 p-[12px] pb-0'>
                    <textarea
                        aria-label={t('english_practice.input_title')}
                        className='h-full min-h-[76px] w-full resize-none bg-content1 outline-none'
                        style={{ fontSize: `${appFontSize}px` }}
                        value={userText}
                        spellCheck={false}
                        readOnly={isLoading}
                        placeholder={t('english_practice.input_placeholder')}
                        onKeyDown={(event) => {
                            if (event.ctrlKey && event.key === 'Enter') {
                                event.preventDefault();
                                void checkEnglish();
                            }
                        }}
                        onChange={(event) => {
                            setUserText(event.target.value);
                            setError('');
                        }}
                    />
                </CardBody>
                <CardFooter className='flex justify-between rounded-none rounded-b-[10px] bg-content1 px-[12px] p-[5px]'>
                    <Dropdown>
                        <DropdownTrigger>
                            <Button
                                size='sm'
                                variant='light'
                                className='max-w-[70%] justify-start px-2 text-default-600'
                                endContent={<MdKeyboardArrowDown className='shrink-0 text-[16px]' />}
                            >
                                <span className='truncate'>{selectedServiceName}</span>
                            </Button>
                        </DropdownTrigger>
                        <DropdownMenu
                            aria-label={t('english_practice.select_service')}
                            emptyContent={t('english_practice.no_service')}
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
                    <Tooltip content={t('english_practice.check_hint')}>
                        <Button
                            isIconOnly
                            size='sm'
                            color='primary'
                            variant='light'
                            isLoading={isLoading}
                            isDisabled={!canCheck}
                            onPress={() => void checkEnglish()}
                        >
                            <MdAutoFixHigh className='text-[16px]' />
                        </Button>
                    </Tooltip>
                </CardFooter>
            </Card>

            <Card
                shadow='none'
                className='min-h-[180px] flex-[3] bg-content1 rounded-[10px]'
            >
                <CardHeader className='flex px-[12px] pb-0 pt-[9px] text-small font-medium'>
                    <span>{t('english_practice.feedback_title')}</span>
                    {feedbackIsStale && (
                        <span className='ml-auto text-tiny font-normal text-warning'>
                            {t('english_practice.feedback_stale')}
                        </span>
                    )}
                </CardHeader>
                <CardBody className='min-h-0 overflow-y-auto p-[12px]'>
                    {error ? (
                        <div
                            className='whitespace-pre-wrap text-red-500'
                            style={{ fontSize: `${appFontSize}px` }}
                        >
                            {error}
                        </div>
                    ) : feedback ? (
                        <ReactMarkdown
                            className='practice-markdown select-text'
                            style={{ fontSize: `${appFontSize}px` }}
                        >
                            {feedback}
                        </ReactMarkdown>
                    ) : null}
                </CardBody>
                <CardFooter className='flex justify-end rounded-none rounded-b-[10px] bg-content1 px-[12px] p-[5px]'>
                    <Tooltip content={t('translate.copy')}>
                        <Button
                            isIconOnly
                            variant='light'
                            size='sm'
                            isDisabled={!feedback}
                            onPress={() => void writeText(feedback)}
                        >
                            <MdContentCopy className='text-[16px]' />
                        </Button>
                    </Tooltip>
                </CardFooter>
            </Card>
        </div>
    );
}
