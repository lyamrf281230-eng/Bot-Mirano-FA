
const {
    Client,
    GatewayIntentBits,
    PermissionsBitField,
    ChannelType,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require("discord.js");

require("dotenv").config();

const commands = require("./commands/commands");
const fs = require("fs");
const path = require("path");

// ======================================================
// CONFIGURATION
// ======================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration
    ]
});

const PREFIX = "+";
const DATA_DIR = path.join(__dirname, "data");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const WARNINGS_FILE = path.join(DATA_DIR, "warnings.json");

const spamMap = new Map();
const raidMap = new Map();

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({}, null, 2));
}

if (!fs.existsSync(WARNINGS_FILE)) {
    fs.writeFileSync(WARNINGS_FILE, JSON.stringify({}, null, 2));
}

// ======================================================
// FICHIERS JSON
// ======================================================

function loadJSON(file) {
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
        return {};
    }
}

function saveJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function getConfig(guildId) {
    const configs = loadJSON(CONFIG_FILE);

    if (!configs[guildId]) {
        configs[guildId] = {
            logChannel: null,
            welcomeChannel: null,
            antiSpam: true,
            antiLink: true,
            antiRaid: true,
            maxMessages: 6,
            spamWindow: 5000,
            raidMaxJoins: 6,
            raidWindow: 10000
        };

        saveJSON(CONFIG_FILE, configs);
    }

    return configs[guildId];
}

function updateConfig(guildId, changes) {
    const configs = loadJSON(CONFIG_FILE);

    configs[guildId] = {
        ...getConfig(guildId),
        ...changes
    };

    saveJSON(CONFIG_FILE, configs);
}

// ======================================================
// LOGS
// ======================================================

async function sendLog(guild, text) {
    if (!guild) return;

    const config = getConfig(guild.id);

    if (!config.logChannel) return;

    const channel = guild.channels.cache.get(
        config.logChannel
    );

    if (!channel || !channel.isTextBased()) return;

    const embed = new EmbedBuilder()
        .setDescription(text)
        .setColor(0x5865F2)
        .setTimestamp();

    await channel.send({
        embeds: [embed]
    }).catch(() => {});
}

// ======================================================
// OUTILS TICKETS
// ======================================================

const ticketCategories = {
    support: {
        label: "Support",
        emoji: "🎧"
    },
    recrutement: {
        label: "Recrutement",
        emoji: "📋"
    },
    achat: {
        label: "Achat",
        emoji: "🛒"
    },
    owner: {
        label: "Owner",
        emoji: "👑"
    }
};

function isTicketChannel(channel) {
    return Boolean(
        channel &&
        channel.type === ChannelType.GuildText &&
        channel.topic &&
        channel.topic.includes("owner:") &&
        channel.topic.includes("category:")
    );
}

function getTicketOwner(channel) {
    return channel?.topic?.match(/(?:^|;)owner:(\d+)/)?.[1] || null;
}

function getTicketClaim(channel) {
    return channel?.topic?.match(/(?:^|;)claim:(\d+)/)?.[1] || null;
}

function isStaff(interaction) {
    return Boolean(
        interaction.memberPermissions?.has(
            PermissionsBitField.Flags.ManageChannels
        )
    );
}

async function replyPrivate(interaction, content) {
    if (interaction.deferred || interaction.replied) {
        return interaction.followUp({
            content,
            ephemeral: true
        });
    }

    return interaction.reply({
        content,
        ephemeral: true
    });
}

// ======================================================
// BOT CONNECTÉ
// ======================================================

client.once("ready", () => {
    console.log("=================================");
    console.log(`✅ Logs Bot : ${client.user.tag}`);
    console.log(`🌐 Serveurs : ${client.guilds.cache.size}`);
    console.log(`⌨️ Préfixe : ${PREFIX}`);
    console.log("=================================");

    client.user.setPresence({
        activities: [
            {
                name: "+help | midi minuit",
                type: 1,
                url: "https://www.twitch.tv/midiminuit"
            }
        ],
        status: "dnd"
    });
});

// ======================================================
// MESSAGES ET COMMANDES
// ======================================================

client.on("messageCreate", async message => {
    if (!message.guild) return;
    if (message.author.bot) return;

    if (
        client.user &&
        message.mentions.has(client.user) &&
        !message.mentions.everyone
    ) {
        return message.reply(
            "Salut 👋, mon préfix est `+`"
        );
    }

    const config = getConfig(message.guild.id);

    // ANTI-SPAM
    if (config.antiSpam) {
        const now = Date.now();

        const messages = spamMap.get(message.author.id) || [];

        const recent = messages.filter(
            time => now - time <= config.spamWindow
        );

        recent.push(now);
        spamMap.set(message.author.id, recent);

        if (recent.length >= config.maxMessages) {
            await message.delete().catch(() => {});

            const warning = await message.channel.send(
                `⚠️ ${message.author}, arrête le spam.`
            ).catch(() => null);

            if (warning) {
                setTimeout(() => {
                    warning.delete().catch(() => {});
                }, 3000);
            }

            await sendLog(
                message.guild,
                `🚨 Anti-spam : **${message.author.tag}** dans ${message.channel}.`
            );

            spamMap.delete(message.author.id);
            return;
        }
    }

    // ANTI-LIENS
    const linkRegex =
        /(https?:\/\/|www\.|discord\.gg\/|discord\.com\/invite\/)/i;

    if (
        config.antiLink &&
        linkRegex.test(message.content) &&
        !message.member.permissions.has(
            PermissionsBitField.Flags.ManageMessages
        )
    ) {
        await message.delete().catch(() => {});

        const warning = await message.channel.send(
            `🚫 ${message.author}, les liens ne sont pas autorisés ici.`
        ).catch(() => null);

        if (warning) {
            setTimeout(() => {
                warning.delete().catch(() => {});
            }, 3000);
        }

        await sendLog(
            message.guild,
            `🔗 Lien supprimé de **${message.author.tag}** dans ${message.channel}.`
        );

        return;
    }

    // COMMANDES PREFIXE +
    if (!message.content.startsWith(PREFIX)) return;

    const parts = message.content
        .slice(PREFIX.length)
        .trim()
        .split(/\s+/);

    const command = parts.shift()?.toLowerCase();

    if (!command) return;

    try {
        await commands.execute(
            message,
            command,
            parts,
            {
                PREFIX,
                sendLog,
                getConfig,
                updateConfig,
                loadJSON,
                saveJSON,
                WARNINGS_FILE
            }
        );
    } catch (error) {
        console.error("Erreur commande :", error);

        await message.reply(
            "❌ Une erreur est survenue."
        ).catch(() => {});
    }
});

// ======================================================
// INTERACTIONS : MENU, BOUTONS ET FORMULAIRES
// ======================================================

client.on("interactionCreate", async interaction => {
    try {
        // ==================================================
        // MENU DE SÉLECTION DES TICKETS
        // ==================================================

        if (
            interaction.isStringSelectMenu() &&
            interaction.customId === "ticket_select"
        ) {
            const guild = interaction.guild;
            const user = interaction.user;
            const category = interaction.values[0];
            const selected = ticketCategories[category];

            if (!guild || !selected) {
                return replyPrivate(
                    interaction,
                    "❌ Catégorie invalide."
                );
            }

            const existing = guild.channels.cache.find(
                channel =>
                    isTicketChannel(channel) &&
                    getTicketOwner(channel) === user.id
            );

            if (existing) {
                return replyPrivate(
                    interaction,
                    `❌ Tu as déjà un ticket ouvert : ${existing}`
                );
            }

            await interaction.deferReply({
                ephemeral: true
            });

            const channel = await guild.channels.create({
                name: `ticket-${category}-${user.id}`,
                type: ChannelType.GuildText,
                topic: `owner:${user.id};category:${category}`,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [
                            PermissionsBitField.Flags.ViewChannel
                        ]
                    },
                    {
                        id: user.id,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ReadMessageHistory
                        ]
                    },
                    {
                        id: client.user.id,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ReadMessageHistory,
                            PermissionsBitField.Flags.ManageChannels
                        ]
                    }
                ]
            });

            const ticketButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId("ticket_claim")
                        .setLabel("Claim")
                        .setEmoji("🙋")
                        .setStyle(ButtonStyle.Success),

                    new ButtonBuilder()
                        .setCustomId("ticket_add_member")
                        .setLabel("Ajouter")
                        .setEmoji("➕")
                        .setStyle(ButtonStyle.Primary),

                    new ButtonBuilder()
                        .setCustomId("ticket_remove_member")
                        .setLabel("Retirer")
                        .setEmoji("➖")
                        .setStyle(ButtonStyle.Secondary),

                    new ButtonBuilder()
                        .setCustomId("ticket_close")
                        .setLabel("Fermer")
                        .setEmoji("🔒")
                        .setStyle(ButtonStyle.Danger)
                );

            const embed = new EmbedBuilder()
                .setTitle(`${selected.emoji}・Ticket ${selected.label}`)
                .setDescription(
                    `Bonjour ${user} !\n\n` +
                    `**Catégorie :** ${selected.label}\n\n` +
                    "Explique ta demande ici. Un membre du staff pourra te répondre."
                )
                .setColor(0x5865F2)
                .setTimestamp();

            await channel.send({
                content: `${user}`,
                embeds: [embed],
                components: [ticketButtons]
            });

            await interaction.editReply({
                content: `✅ Ton ticket a été créé : ${channel}`
            });

            await sendLog(
                guild,
                `🎫 Ticket **${selected.label}** créé par **${user.tag}** : ${channel}`
            );

            return;
        }

        // ==================================================
        // BOUTONS : CLAIM, AJOUTER, RETIRER, FERMER
        // ==================================================

        if (interaction.isButton()) {
            const customId = interaction.customId;
            const channel = interaction.channel;
            const guild = interaction.guild;

            if (
                [
                    "ticket_claim",
                    "ticket_add_member",
                    "ticket_remove_member",
                    "ticket_close"
                ].includes(customId)
            ) {
                if (!guild || !isTicketChannel(channel)) {
                    return replyPrivate(
                        interaction,
                        "❌ Cette action fonctionne uniquement dans un ticket."
                    );
                }

                const ownerId = getTicketOwner(channel);
                const staff = isStaff(interaction);

                // CLAIM
                if (customId === "ticket_claim") {
                    if (!staff) {
                        return replyPrivate(
                            interaction,
                            "❌ Seul le staff autorisé peut prendre un ticket."
                        );
                    }

                    const currentClaim = getTicketClaim(channel);

                    if (currentClaim) {
                        return replyPrivate(
                            interaction,
                            `⚠️ Ce ticket est déjà pris en charge par <@${currentClaim}>.`
                        );
                    }

                    await channel.setTopic(
                        `${channel.topic};claim:${interaction.user.id}`
                    );

                    await interaction.reply({
                        content: `🙋 ${interaction.user} prend en charge ce ticket.`
                    });

                    await sendLog(
                        guild,
                        `🙋 Ticket ${channel} pris en charge par **${interaction.user.tag}**.`
                    );

                    return;
                }

                // AJOUTER / RETIRER UN MEMBRE
                if (
                    customId === "ticket_add_member" ||
                    customId === "ticket_remove_member"
                ) {
                    if (!staff) {
                        return replyPrivate(
                            interaction,
                            "❌ Seul le staff autorisé peut gérer les membres du ticket."
                        );
                    }

                    const adding = customId === "ticket_add_member";

                    const modal = new ModalBuilder()
                        .setCustomId(
                            adding
                                ? "ticket_add_member_modal"
                                : "ticket_remove_member_modal"
                        )
                        .setTitle(
                            adding
                                ? "Ajouter un membre"
                                : "Retirer un membre"
                        );

                    const memberInput = new TextInputBuilder()
                        .setCustomId("member_id")
                        .setLabel("ID Discord du membre")
                        .setPlaceholder("Exemple : 123456789012345678")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setMinLength(17)
                        .setMaxLength(20);

                    modal.addComponents(
                        new ActionRowBuilder().addComponents(memberInput)
                    );

                    await interaction.showModal(modal);
                    return;
                }

                // FERMER LE TICKET
                if (customId === "ticket_close") {
                    if (
                        interaction.user.id !== ownerId &&
                        !staff
                    ) {
                        return replyPrivate(
                            interaction,
                            "❌ Seul le créateur du ticket ou le staff autorisé peut le fermer."
                        );
                    }

                    await interaction.reply({
                        content: "🔒 Fermeture du ticket..."
                    });

                    await sendLog(
                        guild,
                        `🔒 Ticket ${channel} fermé par **${interaction.user.tag}**.`
                    );

                    setTimeout(() => {
                        channel.delete().catch(() => {});
                    }, 1500);

                    return;
                }
            }

            return;
        }

        // ==================================================
        // FORMULAIRES : AJOUTER / RETIRER UN MEMBRE
        // ==================================================

        if (
            interaction.isModalSubmit() &&
            [
                "ticket_add_member_modal",
                "ticket_remove_member_modal"
            ].includes(interaction.customId)
        ) {
            const channel = interaction.channel;
            const guild = interaction.guild;

            if (!guild || !isTicketChannel(channel)) {
                return replyPrivate(
                    interaction,
                    "❌ Ce salon n'est pas un ticket valide."
                );
            }

            if (!isStaff(interaction)) {
                return replyPrivate(
                    interaction,
                    "❌ Permission insuffisante."
                );
            }

            const memberId = interaction.fields
                .getTextInputValue("member_id")
                .trim();

            if (!/^\d{17,20}$/.test(memberId)) {
                return replyPrivate(
                    interaction,
                    "❌ ID Discord invalide."
                );
            }

            const member = await guild.members
                .fetch(memberId)
                .catch(() => null);

            if (!member) {
                return replyPrivate(
                    interaction,
                    "❌ Membre introuvable sur ce serveur."
                );
            }

            const adding =
                interaction.customId === "ticket_add_member_modal";

            const ownerId = getTicketOwner(channel);

            if (!adding && member.id === ownerId) {
                return replyPrivate(
                    interaction,
                    "❌ Tu ne peux pas retirer l'accès au créateur du ticket."
                );
            }

            if (!adding && member.id === client.user.id) {
                return replyPrivate(
                    interaction,
                    "❌ Tu ne peux pas retirer l'accès au bot."
                );
            }

            await interaction.deferReply({
                ephemeral: true
            });

            if (adding) {
                await channel.permissionOverwrites.edit(
                    member.id,
                    {
                        ViewChannel: true,
                        SendMessages: true,
                        ReadMessageHistory: true
                    }
                );

                await interaction.editReply({
                    content: `✅ ${member} peut maintenant accéder au ticket.`
                });

                await channel.send(
                    `➕ ${member} a été ajouté au ticket par ${interaction.user}.`
                );

                await sendLog(
                    guild,
                    `➕ **${member.user.tag}** ajouté au ticket ${channel} par **${interaction.user.tag}**.`
                );
            } else {
                const overwrite =
                    channel.permissionOverwrites.cache.get(member.id);

                if (overwrite) {
                    await channel.permissionOverwrites.delete(member.id);
                } else {
                    await channel.permissionOverwrites.edit(
                        member.id,
                        {
                            ViewChannel: false,
                            SendMessages: false,
                            ReadMessageHistory: false
                        }
                    );
                }

                await interaction.editReply({
                    content: `✅ L'accès de ${member} au ticket a été retiré.`
                });

                await channel.send(
                    `➖ L'accès de ${member} a été retiré par ${interaction.user}.`
                );

                await sendLog(
                    guild,
                    `➖ Accès de **${member.user.tag}** retiré du ticket ${channel} par **${interaction.user.tag}**.`
                );
            }

            return;
        }
    } catch (error) {
        console.error("Erreur interaction :", error);

        if (interaction.isRepliable()) {
            await replyPrivate(
                interaction,
                "❌ Une erreur est survenue. Vérifie les permissions du bot."
            ).catch(() => {});
        }
    }
});

// ======================================================
// ARRIVÉE D'UN MEMBRE
// ======================================================

client.on("guildMemberAdd", async member => {
    const guild = member.guild;
    const config = getConfig(guild.id);

    if (config.antiRaid) {
        const now = Date.now();
        const joins = raidMap.get(guild.id) || [];

        const recent = joins.filter(
            time => now - time <= config.raidWindow
        );

        recent.push(now);
        raidMap.set(guild.id, recent);

        if (recent.length >= config.raidMaxJoins) {
            await sendLog(
                guild,
                `🚨 **ANTI-RAID** : ${recent.length} arrivées rapides détectées.`
            );
        }
    }

    if (config.welcomeChannel) {
        const channel = guild.channels.cache.get(
            config.welcomeChannel
        );

        if (channel && channel.isTextBased()) {
            await channel.send(
                `👋 Bienvenue ${member} sur **${guild.name}** !`
            ).catch(() => {});
        }
    }

    await sendLog(
        guild,
        `📥 **${member.user.tag}** a rejoint le serveur.`
    );
});

// ======================================================
// DÉPART D'UN MEMBRE
// ======================================================

client.on("guildMemberRemove", async member => {
    await sendLog(
        member.guild,
        `📤 **${member.user.tag}** a quitté le serveur.`
    );
});

// ======================================================
// ERREURS
// ======================================================

process.on("unhandledRejection", error => {
    console.error("Unhandled rejection :", error);
});

process.on("uncaughtException", error => {
    console.error("Uncaught exception :", error);
});

// ======================================================
// CONNEXION
// ======================================================

client.login(process.env.DISCORD_TOKEN);
