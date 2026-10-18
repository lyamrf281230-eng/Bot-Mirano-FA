const {
    Client,
    GatewayIntentBits,
    PermissionsBitField,
    ChannelType,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

require("dotenv").config();

const commands = require("./commands/commands");
const fs = require("fs");
const path = require("path");

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

async function sendLog(guild, text) {
    const config = getConfig(guild.id);

    if (!config.logChannel) return;

    const channel = guild.channels.cache.get(config.logChannel);

    if (!channel || !channel.isTextBased()) return;

    const embed = new EmbedBuilder()
        .setDescription(text)
        .setTimestamp();

    await channel.send({
        embeds: [embed]
    }).catch(() => {});
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
// MENTION DU BOT
// ======================================================

client.on("messageCreate", async message => {
    if (!message.guild) return;
    if (message.author.bot) return;

    if (
        message.mentions.has(client.user) &&
        !message.mentions.everyone
    ) {
        return message.reply(
            "Salut 👋, mon préfix est `+`"
        );
    }

    const config = getConfig(message.guild.id);

    // ==================================================
    // ANTI-SPAM
    // ==================================================

    if (config.antiSpam) {
        const now = Date.now();

        const messages =
            spamMap.get(message.author.id) || [];

        const recent =
            messages.filter(
                time => now - time <= config.spamWindow
            );

        recent.push(now);

        spamMap.set(
            message.author.id,
            recent
        );

        if (recent.length >= config.maxMessages) {
            await message.delete().catch(() => {});

            const warning =
                await message.channel.send(
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

    // ==================================================
    // ANTI-LIENS
    // ==================================================

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

        const warning =
            await message.channel.send(
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

    // ==================================================
    // COMMANDES
    // ==================================================

    if (!message.content.startsWith(PREFIX)) return;

    const parts =
        message.content
            .slice(PREFIX.length)
            .trim()
            .split(/\s+/);

    const command =
        parts.shift()?.toLowerCase();

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
        console.error(error);

        await message.reply(
            "❌ Une erreur est survenue."
        ).catch(() => {});
    }
});

// ======================================================
// ARRIVÉE D'UN MEMBRE
// ======================================================

client.on("guildMemberAdd", async member => {
    const guild = member.guild;
    const config = getConfig(guild.id);

    // Anti-raid
    if (config.antiRaid) {
        const now = Date.now();

        const joins =
            raidMap.get(guild.id) || [];

        const recent =
            joins.filter(
                time =>
                    now - time <= config.raidWindow
            );

        recent.push(now);

        raidMap.set(
            guild.id,
            recent
        );

        if (
            recent.length >=
            config.raidMaxJoins
        ) {
            await sendLog(
                guild,
                `🚨 **ANTI-RAID** : ${recent.length} arrivées rapides détectées.`
            );
        }
    }

    // Bienvenue
    if (config.welcomeChannel) {
        const channel =
            guild.channels.cache.get(
                config.welcomeChannel
            );

        if (
            channel &&
            channel.isTextBased()
        ) {
            channel.send(
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
// DÉPART
// ======================================================

client.on("guildMemberRemove", async member => {
    await sendLog(
        member.guild,
        `📤 **${member.user.tag}** a quitté le serveur.`
    );
});

// ======================================================
// TICKETS
// ======================================================

client.on("interactionCreate", async interaction => {
    // Menu de sélection des tickets
    if (
        interaction.isStringSelectMenu() &&
        interaction.customId === "ticket_select"
    ) {
        const guild = interaction.guild;
        const user = interaction.user;
        const category = interaction.values[0];

        const categories = {
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

        const selected = categories[category];

        if (!selected || !guild) {
            return interaction.reply({
                content: "❌ Catégorie invalide.",
                ephemeral: true
            });
        }

        const existing = guild.channels.cache.find(channel =>
            channel.type === ChannelType.GuildText &&
            channel.topic?.includes(`owner:${user.id}`)
        );

        if (existing) {
            return interaction.reply({
                content: `❌ Tu as déjà un ticket : ${existing}`,
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
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

            const closeRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId("ticket_close")
                        .setLabel("Fermer le ticket")
                        .setEmoji("🔒")
                        .setStyle(ButtonStyle.Danger)
                );

            const embed = new EmbedBuilder()
                .setTitle(`${selected.emoji}・Ticket ${selected.label}`)
                .setDescription(
                    `Bonjour ${user} !\n\n` +
                    `Ta demande concerne : **${selected.label}**.\n` +
                    "Explique ta demande ici, le staff pourra te répondre."
                )
                .setColor(0x5865F2)
                .setTimestamp();

            await channel.send({
                content: `${user}`,
                embeds: [embed],
                components: [closeRow]
            });

            await interaction.editReply({
                content: `✅ Ton ticket ${selected.label} a été créé : ${channel}`
            });

            await sendLog(
                guild,
                `🎫 Ticket **${selected.label}** créé par **${user.tag}** : ${channel}`
            );
        } catch (error) {
            console.error("Erreur ticket :", error);

            await interaction.editReply({
                content: "❌ Impossible de créer le ticket. Vérifie les permissions du bot."
            }).catch(() => {});
        }

        return;
    }

    // Les autres interactions gérées ici sont des boutons
    if (!interaction.isButton()) return;

    if (interaction.customId === "ticket_close") {
        const channel = interaction.channel;
        const userId = interaction.user.id;
        const isOwner = channel?.topic?.includes(`owner:${userId}`);
        const canManage = interaction.memberPermissions?.has(
            PermissionsBitField.Flags.ManageChannels
        );

        if (!isOwner && !canManage) {
            return interaction.reply({
                content: "❌ Tu ne peux pas fermer ce ticket.",
                ephemeral: true
            });
        }

        await interaction.reply({
            content: "🔒 Fermeture du ticket..."
        });

        await sendLog(
            interaction.guild,
            `🔒 Ticket ${channel} fermé par **${interaction.user.tag}**.`
        );

        setTimeout(() => {
            channel.delete().catch(() => {});
        }, 1500);
    }
});

// ======================================================
// ERREURS
// ======================================================

process.on(
    "unhandledRejection",
    error => console.error(error)
);

process.on(
    "uncaughtException",
    error => console.error(error)
);

// ======================================================
// LOGIN
// ======================================================

client.login(
    process.env.DISCORD_TOKEN
);