import { Modal, Setting, TextAreaComponent } from "obsidian";
import type { Models_And_Ask_Me } from "src/ai/models";
import { models_and_ask_me } from "src/ai/models";
import { FormatSyntaxSuggester } from "./../suggesters/formatSyntaxSuggester";
import QuickAdd from "src/main";
import { FormatDisplayFormatter } from "src/formatters/formatDisplayFormatter";
import type { IAIAssistantCommand } from "src/types/macros/QuickCommands/IAIAssistantCommand";
import { GenericTextSuggester } from "../suggesters/genericTextSuggester";
import { getMarkdownFilesInFolder } from "src/utilityObsidian";
import { settingsStore } from "src/settingsStore";
import GenericInputPrompt from "../GenericInputPrompt/GenericInputPrompt";
import {
	DEFAULT_FREQUENCY_PENALTY,
	DEFAULT_PRESENCE_PENALTY,
	DEFAULT_TEMPERATURE,
	DEFAULT_TOP_P,
} from "src/ai/OpenAIModelParameters";

export class AIAssistantCommandSettingsModal extends Modal {
	public waitForClose: Promise<IAIAssistantCommand>;

	private resolvePromise: (settings: IAIAssistantCommand) => void;
	private rejectPromise: (reason?: unknown) => void;

	private settings: IAIAssistantCommand;
	private showAdvancedSettings = false;

	constructor(settings: IAIAssistantCommand) {
		super(app);

		this.settings = settings;

		this.waitForClose = new Promise<IAIAssistantCommand>(
			(resolve, reject) => {
				this.rejectPromise = reject;
				this.resolvePromise = resolve;
			}
		);

		this.open();
		this.display();
	}

	private display(): void {
		const header = this.contentEl.createEl("h2", {
			text: `${this.settings.name} Settings`,
		});

		header.style.textAlign = "center";
		header.style.cursor = "pointer";
		header.style.userSelect = "none";
		// eslint-disable-next-line @typescript-eslint/no-misused-promises
		header.addEventListener("click", async () => {
			try {
				const newName = await GenericInputPrompt.Prompt(
					app,
					"New name",
					this.settings.name,
					this.settings.name
				);

				if (newName && newName !== this.settings.name) {
					this.settings.name = newName;
					this.reload();
				}
			} catch (error) {} // no new name, don't need exceptional state for that
		});

		this.addPromptTemplateSetting(this.contentEl);
		this.addModelSetting(this.contentEl);
		this.addOutputVariableNameSetting(this.contentEl);

		this.addShowAdvancedSettingsToggle(this.contentEl);

		if (this.showAdvancedSettings) {
			if (!this.settings.modelParameters)
				this.settings.modelParameters = {};
			this.addTemperatureSetting(this.contentEl);
			this.addTopPSetting(this.contentEl);
			this.addFrequencyPenaltySetting(this.contentEl);
			this.addPresencePenaltySetting(this.contentEl);
		}

		this.addSystemPromptSetting(this.contentEl);
	}

	private reload(): void {
		this.contentEl.empty();

		this.display();
	}

	addPromptTemplateSetting(container: HTMLElement) {
		const promptTemplatesFolder =
			settingsStore.getState().ai.promptTemplatesFolderPath;
		const promptTemplateFiles = getMarkdownFilesInFolder(
			promptTemplatesFolder
		).map((f) => f.name);

		new Setting(container)
			.setName("Prompt Template")
			.setDesc(
				"Enabling this will have the assistant use the prompt template you specify. If disable, the assistant will ask you for a prompt template to use."
			)
			.addToggle((toggle) => {
				toggle.setValue(this.settings.promptTemplate.enable);
				toggle.onChange((value) => {
					this.settings.promptTemplate.enable = value;
				});
			})
			.addText((text) => {
				text.setValue(this.settings.promptTemplate.name).onChange(
					(value) => {
						this.settings.promptTemplate.name = value;
					}
				);

				new GenericTextSuggester(
					app,
					text.inputEl,
					promptTemplateFiles
				);
			});
	}

	addModelSetting(container: HTMLElement) {
		new Setting(container)
			.setName("Model")
			.setDesc("The model the AI Assistant will use")
			.addDropdown((dropdown) => {
				for (const model of models_and_ask_me) {
					dropdown.addOption(model, model);
				}

				dropdown.setValue(this.settings.model);
				dropdown.onChange((value) => {
					this.settings.model = value as Models_And_Ask_Me;
				});
			});
	}

	addOutputVariableNameSetting(container: HTMLElement) {
		new Setting(container)
			.setName("Output variable name")
			.setDesc(
				"The name of the variable used to store the AI Assistant output, i.e. {{value:output}}."
			)
			.addText((text) => {
				text.setValue(this.settings.outputVariableName).onChange(
					(value) => {
						this.settings.outputVariableName = value;
					}
				);
			});
	}

	addSystemPromptSetting(contentEl: HTMLElement) {
		new Setting(contentEl)
			.setName("System Prompt")
			.setDesc("The system prompt for the AI Assistant");

		const textAreaComponent = new TextAreaComponent(contentEl);
		textAreaComponent
			.setValue(this.settings.systemPrompt)
			.onChange(async (value) => {
				this.settings.systemPrompt = value;

				formatDisplay.innerText = await displayFormatter.format(value);
			});

		new FormatSyntaxSuggester(
			this.app,
			textAreaComponent.inputEl,
			QuickAdd.instance
		);
		const displayFormatter = new FormatDisplayFormatter(
			this.app,
			QuickAdd.instance
		);

		textAreaComponent.inputEl.style.width = "100%";
		textAreaComponent.inputEl.style.height = "100px";
		textAreaComponent.inputEl.style.minHeight = "100px";
		textAreaComponent.inputEl.style.marginBottom = "1em";

		const formatDisplay = this.contentEl.createEl("span");

		void (async () =>
			(formatDisplay.innerText = await displayFormatter.format(
				this.settings.systemPrompt ?? ""
			)))();
	}

	addShowAdvancedSettingsToggle(container: HTMLElement) {
		new Setting(container)
			.setName("Show advanced settings")
			.setDesc(
				"Show advanced settings such as temperature, top p, and frequency penalty."
			)
			.addToggle((toggle) => {
				toggle.setValue(this.showAdvancedSettings);
				toggle.onChange((value) => {
					this.showAdvancedSettings = value;
					this.reload();
				});
			});
	}

	addTemperatureSetting(container: HTMLElement) {
		new Setting(container)
			.setName("Temperature")
			.setDesc(
				"Sampling temperature. Higher values like 0.8 makes the output more random, whereas lower values like 0.2 will make it more focused and deterministic. The default is 1."
			)
			.addSlider((slider) => {
				slider.setLimits(0, 1, 0.1);
				slider.setDynamicTooltip();
				slider.setValue(
					this.settings.modelParameters.temperature ??
						DEFAULT_TEMPERATURE
				);
				slider.onChange((value) => {
					this.settings.modelParameters.temperature = value;
				});
			});
	}

	addTopPSetting(container: HTMLElement) {
		new Setting(container)
			.setName("Top P")
			.setDesc(
				"Nucleus sampling - consider this an alternative to temperature. The model considers the results of the tokens with top_p probability mass. 0.1 means only tokens compromising the top 10% probability mass are considered. The default is 1."
			)
			.addSlider((slider) => {
				slider.setLimits(0, 1, 0.1);
				slider.setDynamicTooltip();
				slider.setValue(
					this.settings.modelParameters.top_p ?? DEFAULT_TOP_P
				);
				slider.onChange((value) => {
					this.settings.modelParameters.top_p = value;
				});
			});
	}

	addFrequencyPenaltySetting(container: HTMLElement) {
		new Setting(container)
			.setName("Frequency Penalty")
			.setDesc(
				"Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim. The default is 0."
			)
			.addSlider((slider) => {
				slider.setLimits(0, 2, 0.1);
				slider.setDynamicTooltip();
				slider.setValue(
					this.settings.modelParameters.frequency_penalty ??
						DEFAULT_FREQUENCY_PENALTY
				);
				slider.onChange((value) => {
					this.settings.modelParameters.frequency_penalty = value;
				});
			});
	}

	addPresencePenaltySetting(container: HTMLElement) {
		new Setting(container)
			.setName("Presence Penalty")
			.setDesc(
				"Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics. The default is 0."
			)
			.addSlider((slider) => {
				slider.setLimits(0, 2, 0.1);
				slider.setDynamicTooltip();
				slider.setValue(
					this.settings.modelParameters.presence_penalty ??
						DEFAULT_PRESENCE_PENALTY
				);
				slider.onChange((value) => {
					this.settings.modelParameters.presence_penalty = value;
				});
			});
	}

	addChunkJoinerSetting(container: HTMLElement) {
		new Setting(container)
			.setName("Chunk Joiner")
			.setDesc(
				"The string used to join chunks of text together. The default is a newline."
		)
			.addText((text) => {
				text.setValue(this.settings.chunkJoiner).onChange(
					(value) => {
						this.settings.chunkJoiner = value;
					}
				);
			}
		);
	}

	addChunkSeparatorSetting(container: HTMLElement) {
		new Setting(container)
			.setName("Chunk Separator")
			.setDesc(
				"The string used to separate chunks of text. The default is a newline."
		)
			.addText((text) => {
				text.setValue(this.settings.chunkSeparator).onChange(
					(value) => {
						this.settings.chunkSeparator = value;
					}
				);
			}
		);
	}

	addMaxTokensSetting(container: HTMLElement) {
		new Setting(container)
			.setName("Max Chunk Tokens")
			.setDesc(
				"The maximum number of tokens in each chunk, calculated as the chunk token size + prompt template token size + system prompt token size. Make sure you leave room for the model to respond to the prompt."
		)
			.addText((text) => {
				text.setValue(this.settings.maxTokens).onChange(
					(value) => {
						this.settings.maxTokens = value;
					}
				);
			}
		);
	}

	addMergeChunksSetting(container: HTMLElement) {
		new Setting(container)
			.setName("Merge Chunks")
			.setDesc(
				"Merge chunks together by putting them in the same prompt, until the max tokens limit is reached. Useful for sending fewer queries overall, but may result in less coherent responses."
			)
			.addToggle((toggle) => {
				toggle.setValue(this.settings.mergeChunks);
				toggle.onChange((value) => {
					this.settings.mergeChunks = value;
				});
			});
	}

	onClose(): void {
		this.resolvePromise(this.settings);
		super.onClose();
	}
}
