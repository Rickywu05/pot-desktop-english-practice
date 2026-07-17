import { Input, Button, Switch, Textarea, Card, CardBody, Link } from '@nextui-org/react';
import { DropdownTrigger } from '@nextui-org/react';
import { MdDeleteOutline } from 'react-icons/md';
import { DropdownMenu } from '@nextui-org/react';
import { DropdownItem } from '@nextui-org/react';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Dropdown } from '@nextui-org/react';
import { open } from '@tauri-apps/api/shell';
import React, { useEffect, useState } from 'react';

import { useConfig } from '../../../hooks/useConfig';
import { useToastStyle } from '../../../hooks';
import { translate } from './index';
import { Language } from './index';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import { defaultRequestArguments, OPENAI_COMPATIBLE_PROTOCOL } from '../../openai_compatible';
import { DEFAULT_OPENAI_PROVIDER_PRESET, inferOpenAIProviderPreset, OPENAI_PROVIDER_PRESETS } from './presets';
import { persistOpenAIServiceInstance } from './service_persistence';

export { defaultRequestArguments } from '../../openai_compatible';

export function Config(props) {
    const { instanceKey, onClose } = props;
    const { t } = useTranslation();
    const defaultPreset = OPENAI_PROVIDER_PRESETS[DEFAULT_OPENAI_PROVIDER_PRESET];
    const [openaiConfig, setOpenaiConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: defaultPreset.name,
            service: 'openai',
            apiProtocol: OPENAI_COMPATIBLE_PROTOCOL,
            providerPreset: DEFAULT_OPENAI_PROVIDER_PRESET,
            requestPath: defaultPreset.requestPath,
            model: defaultPreset.model,
            apiKey: '',
            stream: false,
            promptList: [
                {
                    role: 'system',
                    content:
                        'You are a professional translation engine, please translate the text into a colloquial, professional, elegant and fluent content, without the style of machine translation. You must only translate the text content, never interpret it.',
                },
                { role: 'user', content: `Translate into $to:\n"""\n$text\n"""` },
            ],
            requestArguments: defaultPreset.requestArguments,
            customHeaders: defaultPreset.customHeaders,
        },
        { sync: false }
    );
    // 兼容旧版本
    useEffect(() => {
        if (!openaiConfig) return;

        const missingValues = {};
        if (openaiConfig.promptList === undefined) {
            missingValues.promptList = [
                {
                    role: 'system',
                    content:
                        'You are a professional translation engine, please translate the text into a colloquial, professional, elegant and fluent content, without the style of machine translation. You must only translate the text content, never interpret it.',
                },
                { role: 'user', content: `Translate into $to:\n"""\n$text\n"""` },
            ];
        }
        if (openaiConfig.requestArguments === undefined) {
            missingValues.requestArguments = defaultRequestArguments;
        }
        if (openaiConfig.apiProtocol === undefined) {
            missingValues.apiProtocol = OPENAI_COMPATIBLE_PROTOCOL;
        }
        if (openaiConfig.customHeaders === undefined) {
            missingValues.customHeaders = '{}';
        }
        if (openaiConfig.providerPreset === undefined) {
            missingValues.providerPreset = inferOpenAIProviderPreset(openaiConfig);
        }

        if (Object.keys(missingValues).length > 0) {
            setOpenaiConfig({
                ...openaiConfig,
                ...missingValues,
            });
        }
    }, [openaiConfig, setOpenaiConfig]);

    const [isTesting, setIsTesting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const selectedPresetKey = openaiConfig ? inferOpenAIProviderPreset(openaiConfig) : 'custom';
    const selectedPreset = OPENAI_PROVIDER_PRESETS[selectedPresetKey];
    const providerOptions = [...Object.entries(OPENAI_PROVIDER_PRESETS), ['custom', null]];

    const selectProviderPreset = (key) => {
        const presetKey = String(key);
        const preset = OPENAI_PROVIDER_PRESETS[presetKey];

        if (!preset) {
            setOpenaiConfig({ ...openaiConfig, providerPreset: 'custom' });
            setShowAdvanced(true);
            return;
        }

        setOpenaiConfig({
            ...openaiConfig,
            [INSTANCE_NAME_CONFIG_KEY]: preset.name,
            service: 'openai',
            apiProtocol: OPENAI_COMPATIBLE_PROTOCOL,
            providerPreset: presetKey,
            requestPath: preset.requestPath,
            model: preset.model,
            stream: false,
            requestArguments: preset.requestArguments,
            customHeaders: preset.customHeaders,
        });
    };

    const toastStyle = useToastStyle();

    const testConnection = async () => {
        setIsTesting(true);
        try {
            await translate('hello', Language.auto, Language.zh_cn, { config: openaiConfig });
            toast.success(t('config.service.test_success'), { style: toastStyle });
        } catch (error) {
            toast.error(`${t('config.service.test_failed')}: ${error}`, { style: toastStyle });
        } finally {
            setIsTesting(false);
        }
    };

    const saveConfig = async () => {
        setIsSaving(true);
        try {
            await persistOpenAIServiceInstance(instanceKey, openaiConfig);
            onClose();
        } catch (error) {
            toast.error(`${t('config.service.save_failed')}: ${error}`, { style: toastStyle });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        openaiConfig !== null && (
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    void saveConfig();
                }}
            >
                <Toaster />
                <div className='config-item'>
                    <h3 className='my-auto'>{t('services.translate.openai.preset')}</h3>
                    <Dropdown>
                        <DropdownTrigger>
                            <Button
                                variant='bordered'
                                className='max-w-[60%] justify-between'
                            >
                                {selectedPreset
                                    ? `${selectedPreset.name} · ${selectedPreset.model}`
                                    : t('services.translate.openai.custom_preset')}
                            </Button>
                        </DropdownTrigger>
                        <DropdownMenu
                            aria-label={t('services.translate.openai.preset')}
                            selectedKeys={new Set([selectedPresetKey])}
                            selectionMode='single'
                            onAction={selectProviderPreset}
                        >
                            {providerOptions.map(([key, preset]) => (
                                <DropdownItem
                                    key={key}
                                    textValue={preset?.name ?? t('services.translate.openai.custom_preset')}
                                >
                                    {preset ? (
                                        <div className='flex flex-col'>
                                            <span>{preset.name}</span>
                                            <span className='text-tiny text-default-500'>{preset.model}</span>
                                        </div>
                                    ) : (
                                        t('services.translate.openai.custom_preset')
                                    )}
                                </DropdownItem>
                            ))}
                        </DropdownMenu>
                    </Dropdown>
                </div>
                <p className='mb-3 text-[11px] text-default-500'>{t('services.translate.openai.preset_description')}</p>
                {showAdvanced && (
                    <>
                        <div className='config-item'>
                            <Input
                                label={t('services.instance_name')}
                                labelPlacement='outside-left'
                                value={openaiConfig[INSTANCE_NAME_CONFIG_KEY]}
                                variant='bordered'
                                classNames={{
                                    base: 'justify-between',
                                    label: 'text-[length:--nextui-font-size-medium]',
                                    mainWrapper: 'max-w-[50%]',
                                }}
                                onValueChange={(value) => {
                                    setOpenaiConfig({
                                        ...openaiConfig,
                                        [INSTANCE_NAME_CONFIG_KEY]: value,
                                    });
                                }}
                            />
                        </div>
                        <div className='config-item'>
                            <h3 className='my-auto'>{t('services.help')}</h3>
                            <Button
                                onPress={() => {
                                    open('https://pot-app.com/docs/api/translate/openai.html');
                                }}
                            >
                                {t('services.help')}
                            </Button>
                        </div>
                        <div className='config-item'>
                            <h3 className='my-auto'>{t('services.translate.openai.service')}</h3>
                            <Dropdown>
                                <DropdownTrigger>
                                    <Button variant='bordered'>
                                        {t(`services.translate.openai.${openaiConfig.service}`)}
                                    </Button>
                                </DropdownTrigger>
                                <DropdownMenu
                                    autoFocus='first'
                                    aria-label='service'
                                    onAction={(key) => {
                                        setOpenaiConfig({
                                            ...openaiConfig,
                                            service: key,
                                            providerPreset: 'custom',
                                        });
                                    }}
                                >
                                    <DropdownItem key='openai'>{t(`services.translate.openai.openai`)}</DropdownItem>
                                    <DropdownItem key='azure'>{t(`services.translate.openai.azure`)}</DropdownItem>
                                </DropdownMenu>
                            </Dropdown>
                        </div>
                        <div className='config-item'>
                            <Switch
                                isSelected={openaiConfig['stream']}
                                onValueChange={(value) => {
                                    setOpenaiConfig({
                                        ...openaiConfig,
                                        stream: value,
                                    });
                                }}
                                classNames={{
                                    base: 'flex flex-row-reverse justify-between w-full max-w-full',
                                }}
                            >
                                {t('services.translate.openai.stream')}
                            </Switch>
                        </div>
                        <div className='config-item'>
                            <Input
                                label={t('services.translate.openai.request_path')}
                                labelPlacement='outside-left'
                                value={openaiConfig['requestPath']}
                                variant='bordered'
                                classNames={{
                                    base: 'justify-between',
                                    label: 'text-[length:--nextui-font-size-medium]',
                                    mainWrapper: 'max-w-[50%]',
                                }}
                                onValueChange={(value) => {
                                    setOpenaiConfig({
                                        ...openaiConfig,
                                        requestPath: value,
                                        providerPreset: 'custom',
                                    });
                                }}
                            />
                        </div>
                    </>
                )}
                <div className='config-item'>
                    <Input
                        label={t('services.translate.openai.api_key')}
                        labelPlacement='outside-left'
                        type='password'
                        value={openaiConfig['apiKey']}
                        variant='bordered'
                        classNames={{
                            base: 'justify-between',
                            label: 'text-[length:--nextui-font-size-medium]',
                            mainWrapper: 'max-w-[50%]',
                        }}
                        onValueChange={(value) => {
                            setOpenaiConfig({
                                ...openaiConfig,
                                apiKey: value,
                            });
                        }}
                    />
                </div>
                {showAdvanced && (
                    <>
                        <Card
                            isBlurred
                            className='border-none bg-success/20 dark:bg-success/10'
                            shadow='sm'
                        >
                            <CardBody>
                                <div>
                                    推荐
                                    <Link
                                        isExternal
                                        href='https://aihubmix.com/register?aff=trJY'
                                        color='primary'
                                    >
                                        AiHubMix
                                    </Link>
                                    的OpenAI API 密钥，速度飞快，经济实惠，1美元的OpenAI API 额度只需人民币6.3元
                                    <Link
                                        isExternal
                                        href='https://pot-app.com/ads/aihubmix.html'
                                        color='primary'
                                    >
                                        配置文档
                                    </Link>
                                </div>
                            </CardBody>
                        </Card>
                        <div className={`config-item ${openaiConfig.service === 'azure' && 'hidden'}`}>
                            <Input
                                label={t('services.translate.openai.model')}
                                labelPlacement='outside-left'
                                value={openaiConfig['model']}
                                variant='bordered'
                                classNames={{
                                    base: 'justify-between',
                                    label: 'text-[length:--nextui-font-size-medium]',
                                    mainWrapper: 'max-w-[50%]',
                                }}
                                onValueChange={(value) => {
                                    setOpenaiConfig({
                                        ...openaiConfig,
                                        model: value,
                                        providerPreset: 'custom',
                                    });
                                }}
                            />
                        </div>
                        <h3 className='my-auto'>Prompt List</h3>
                        <p className='text-[10px] text-default-700'>
                            {t('services.translate.openai.prompt_description')}
                        </p>

                        <div className='bg-content2 rounded-[10px] p-3'>
                            {openaiConfig.promptList &&
                                openaiConfig.promptList.map((prompt, index) => {
                                    return (
                                        <div
                                            key={`${prompt.role}-${index}`}
                                            className='config-item'
                                        >
                                            <Textarea
                                                label={prompt.role}
                                                labelPlacement='outside'
                                                variant='faded'
                                                value={prompt.content}
                                                placeholder={`Input Some ${prompt.role} Prompt`}
                                                onValueChange={(value) => {
                                                    setOpenaiConfig({
                                                        ...openaiConfig,
                                                        promptList: openaiConfig.promptList.map((p, i) => {
                                                            if (i === index) {
                                                                if (i === 0) {
                                                                    return {
                                                                        role: 'system',
                                                                        content: value,
                                                                    };
                                                                } else {
                                                                    return {
                                                                        role: index % 2 !== 0 ? 'user' : 'assistant',
                                                                        content: value,
                                                                    };
                                                                }
                                                            } else {
                                                                return p;
                                                            }
                                                        }),
                                                    });
                                                }}
                                            />
                                            <Button
                                                isIconOnly
                                                color='danger'
                                                className='my-auto mx-1'
                                                variant='flat'
                                                onPress={() => {
                                                    setOpenaiConfig({
                                                        ...openaiConfig,
                                                        promptList: openaiConfig.promptList.filter(
                                                            (_, i) => i !== index
                                                        ),
                                                    });
                                                }}
                                            >
                                                <MdDeleteOutline className='text-[18px]' />
                                            </Button>
                                        </div>
                                    );
                                })}
                            <Button
                                fullWidth
                                onPress={() => {
                                    setOpenaiConfig({
                                        ...openaiConfig,
                                        promptList: [
                                            ...openaiConfig.promptList,
                                            {
                                                role:
                                                    openaiConfig.promptList.length === 0
                                                        ? 'system'
                                                        : openaiConfig.promptList.length % 2 === 0
                                                          ? 'assistant'
                                                          : 'user',
                                                content: '',
                                            },
                                        ],
                                    });
                                }}
                            >
                                {t('services.translate.openai.add')}
                            </Button>
                        </div>
                        <br />

                        <h3 className='my-auto'>Request Arguments</h3>
                        <div className='config-item'>
                            <Textarea
                                label=''
                                labelPlacement='outside'
                                variant='faded'
                                value={openaiConfig['requestArguments']}
                                placeholder={`Input API Request Arguments`}
                                onValueChange={(value) => {
                                    setOpenaiConfig({
                                        ...openaiConfig,
                                        requestArguments: value,
                                    });
                                }}
                            />
                        </div>
                        <br />
                        <h3 className='my-auto'>{t('services.translate.openai.custom_headers')}</h3>
                        <p className='text-[10px] text-default-700'>
                            {t('services.translate.openai.custom_headers_description')}
                        </p>
                        <div className='config-item'>
                            <Textarea
                                label=''
                                labelPlacement='outside'
                                variant='faded'
                                value={openaiConfig['customHeaders'] ?? '{}'}
                                placeholder='{ "api-key": "$apiKey" }'
                                onValueChange={(value) => {
                                    setOpenaiConfig({
                                        ...openaiConfig,
                                        customHeaders: value,
                                    });
                                }}
                            />
                        </div>
                        <br />
                    </>
                )}
                <Button
                    fullWidth
                    variant='light'
                    className='mb-2 text-default-600'
                    onPress={() => setShowAdvanced((value) => !value)}
                >
                    {showAdvanced
                        ? t('services.translate.openai.hide_advanced')
                        : t('services.translate.openai.show_advanced')}
                </Button>
                <div className='flex gap-2'>
                    <Button
                        type='button'
                        isLoading={isTesting}
                        isDisabled={isTesting || isSaving}
                        fullWidth
                        variant='flat'
                        onPress={() => void testConnection()}
                    >
                        {t('config.service.test_connection')}
                    </Button>
                    <Button
                        type='submit'
                        isLoading={isSaving}
                        isDisabled={isTesting}
                        fullWidth
                        color='primary'
                    >
                        {t('common.save')}
                    </Button>
                </div>
            </form>
        )
    );
}
