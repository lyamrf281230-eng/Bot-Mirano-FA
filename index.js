
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
    TextInputStyle,
    AttachmentBuilder
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
const giveawayMap = new Map();
const xpCooldown = new Map();

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
            antiNuke: true,
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
// OUTILS GIVEAWAY / VÉRIFICATION
// ======================================================

async function startGiveaway(message, prize, durationMs) {
    const endAt = Date.now() + durationMs;

    const embed = new EmbedBuilder()
        .setTitle("🎉 GIVEAWAY")
        .setDescription(
            `**Lot :** ${prize}\n\nClique sur 🎉 Participer pour rejoindre le tirage.\n**Fin :** <t:${Math.floor(endAt / 1000)}:R>\n**Organisateur :** ${message.author}`
        )
        .setColor(0xF1C40F)
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("giveaway_enter")
            .setLabel("Participer")
            .setEmoji("🎉")
            .setStyle(ButtonStyle.Success)
    );

    const giveawayMessage = await message.channel.send({
        embeds: [embed],
        components: [row]
    });

    giveawayMap.set(giveawayMessage.id, {
        guildId: message.guild.id,
        channelId: message.channel.id,
        prize,
        entrants: new Set(),
        ended: false
    });

    await message.reply(`✅ Giveaway créé : ${giveawayMessage}`);

    setTimeout(async () => {
        const data = giveawayMap.get(giveawayMessage.id);

        if (!data || data.ended) return;

        data.ended = true;

        const entrants = [...data.entrants];

        const winnerId = entrants.length
            ? entrants[Math.floor(Math.random() * entrants.length)]
            : null;

        const endedEmbed = EmbedBuilder.from(embed)
            .setTitle("🎉 GIVEAWAY TERMINÉ")
            .setDescription(
                `**Lot :** ${prize}\n**Participants :** ${entrants.length}\n**Gagnant :** ${winnerId ? `<@${winnerId}>` : "Aucun participant"}`
            )
            .setColor(0x2ECC71);

        await giveawayMessage.edit({
            embeds: [endedEmbed],
            components: []
        }).catch(() => {});

        if (winnerId) {
            await message.channel.send(
                `🎉 Félicitations <@${winnerId}> ! Tu remportes **${prize}**.`
            ).catch(() => {});
        }

        giveawayMap.delete(giveawayMessage.id);
    }, durationMs);

    return giveawayMessage;
}

async function sendVerificationPanel(message) {
    const embed = new EmbedBuilder()
        .setTitle("🔐 Vérification")
        .setDescription(
            "Clique sur **Je suis humain** pour obtenir le rôle de membre vérifié.\n\nLe rôle à attribuer doit être configuré avec `+setverified @role`."
        )
        .setColor(0x5865F2);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("verify_member")
            .setLabel("Je suis humain")
            .setEmoji("✅")
            .setStyle(ButtonStyle.Success)
    );

    return message.channel.send({
        embeds: [embed],
        components: [row]
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
                name: "+help | Divinity RP",
                type: 1,
                url: "https://www.twitch.tv/Divinity RP"
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

    // XP : un gain toutes les 60 secondes
    if (!message.content.startsWith(PREFIX)) {
        const xpKey = `${message.guild.id}:${message.author.id}`;
        const nowForXp = Date.now();

        if (
            !xpCooldown.has(xpKey) ||
            nowForXp - xpCooldown.get(xpKey) >= 60000
        ) {
            xpCooldown.set(xpKey, nowForXp);

            const xpFile = path.join(DATA_DIR, "xp.json");
            const xpData = loadJSON(xpFile);

            if (!xpData[message.guild.id]) {
                xpData[message.guild.id] = {};
            }

            if (!xpData[message.guild.id][message.author.id]) {
                xpData[message.guild.id][message.author.id] = {
                    xp: 0
                };
            }

            xpData[message.guild.id][message.author.id].xp +=
                10 + Math.floor(Math.random() * 11);

            saveJSON(xpFile, xpData);
        }
    }

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
                WARNINGS_FILE,
                startGiveaway,
                sendVerificationPanel
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
        // MENU DE SÉLECTION DES TICKETS

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
                `🎫 Ticket créé par **${user.tag}** : ${channel} (${selected.label}).`
            );

            return;
        }

        // ==================================================
        // BOUTONS DES TICKETS
        // ==================================================

        if (
            interaction.isButton() &&
            interaction.customId.startsWith("ticket_")
        ) {
            const channel = interaction.channel;

            if (!isTicketChannel(channel)) {
                return replyPrivate(
                    interaction,
                    "❌ Ce salon n'est pas un ticket reconnu."
                );
            }

            const ticketOwner = getTicketOwner(channel);

            // CLAIM
            if (interaction.customId === "ticket_claim") {
                if (!isStaff(interaction)) {
                    return replyPrivate(
                        interaction,
                        "❌ Réservé au staff."
                    );
                }

                const currentClaim = getTicketClaim(channel);

                if (currentClaim) {
                    return replyPrivate(
                        interaction,
                        `❌ Ce ticket est déjà pris en charge par <@${currentClaim}>.`
                    );
                }

                await channel.setTopic(
                    `${channel.topic};claim:${interaction.user.id}`
                );

                await interaction.reply({
                    content: `🙋 Ticket pris en charge par ${interaction.user}.`,
                    allowedMentions: { users: [interaction.user.id] }
                });

                await sendLog(
                    interaction.guild,
                    `🙋 ${interaction.user.tag} a pris en charge ${channel}.`
                );

                return;
            }

            // AJOUTER UN MEMBRE
            if (interaction.customId === "ticket_add_member") {
                if (!isStaff(interaction)) {
                    return replyPrivate(
                        interaction,
                        "❌ Réservé au staff."
                    );
                }

                const modal = new ModalBuilder()
                    .setCustomId("ticket_add_modal")
                    .setTitle("Ajouter un membre");

                const memberInput = new TextInputBuilder()
                    .setCustomId("member_id")
                    .setLabel("ID Discord du membre")
                    .setPlaceholder("Exemple : 123456789012345678")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(memberInput)
                );

                return interaction.showModal(modal);
            }

            // RETIRER UN MEMBRE
            if (interaction.customId === "ticket_remove_member") {
                if (!isStaff(interaction)) {
                    return replyPrivate(
                        interaction,
                        "❌ Réservé au staff."
                    );
                }

                const modal = new ModalBuilder()
                    .setCustomId("ticket_remove_modal")
                    .setTitle("Retirer un membre");

                const memberInput = new TextInputBuilder()
                    .setCustomId("member_id")
                    .setLabel("ID Discord du membre")
                    .setPlaceholder("Exemple : 123456789012345678")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(memberInput)
                );

                return interaction.showModal(modal);
            }

            // FERMER LE TICKET
            if (interaction.customId === "ticket_close") {
                const isOwner = interaction.user.id === ticketOwner;

                if (!isOwner && !isStaff(interaction)) {
                    return replyPrivate(
                        interaction,
                        "❌ Seul l'auteur du ticket ou le staff peut le fermer."
                    );
                }

                await interaction.reply({
                    content: "🔒 Fermeture du ticket dans 3 secondes..."
                });

                await sendLog(
                    interaction.guild,
                    `🔒 Ticket ${channel.name} fermé par **${interaction.user.tag}**.`
                );

                setTimeout(() => {
                    channel.delete(
                        `Ticket fermé par ${interaction.user.tag}`
                    ).catch(() => {});
                }, 3000);

                return;
            }
        }

        // ==================================================
        // FORMULAIRES : AJOUT / RETRAIT DE MEMBRES
        // ==================================================

        if (
            interaction.isModalSubmit() &&
            (
                interaction.customId === "ticket_add_modal" ||
                interaction.customId === "ticket_remove_modal"
            )
        ) {
            const channel = interaction.channel;

            if (!isTicketChannel(channel) || !isStaff(interaction)) {
                return replyPrivate(
                    interaction,
                    "❌ Action impossible ou permissions insuffisantes."
                );
            }

            const memberId = interaction.fields
                .getTextInputValue("member_id")
                .trim();

            if (!/^\d{17,20}$/.test(memberId)) {
                return replyPrivate(
                    interaction,
                    "❌ L'ID Discord semble invalide."
                );
            }

            const adding =
                interaction.customId === "ticket_add_modal";

            const member = await interaction.guild.members
                .fetch(memberId)
                .catch(() => null);

            if (!member) {
                return replyPrivate(
                    interaction,
                    "❌ Membre introuvable sur ce serveur."
                );
            }

            if (adding) {
                await channel.permissionOverwrites.edit(member.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });

                await interaction.reply({
                    content: `✅ ${member} a été ajouté au ticket.`,
                    allowedMentions: { users: [member.id] }
                });

                await sendLog(
                    interaction.guild,
                    `➕ ${member.user.tag} ajouté à ${channel} par ${interaction.user.tag}.`
                );
            } else {
                if (member.id === getTicketOwner(channel)) {
                    return replyPrivate(
                        interaction,
                        "❌ Tu ne peux pas retirer l'auteur du ticket."
                    );
                }

                await channel.permissionOverwrites.delete(member.id)
                    .catch(() => {});

                await interaction.reply({
                    content: `✅ ${member} a été retiré du ticket.`,
                    allowedMentions: { users: [member.id] }
                });

                await sendLog(
                    interaction.guild,
                    `➖ ${member.user.tag} retiré de ${channel} par ${interaction.user.tag}.`
                );
            }

            return;
        }

        // ==================================================
        // PARTICIPATION AU GIVEAWAY
        // ==================================================

        if (
            interaction.isButton() &&
            interaction.customId === "giveaway_enter"
        ) {
            const giveaway = giveawayMap.get(
                interaction.message.id
            );

            if (!giveaway || giveaway.ended) {
                return replyPrivate(
                    interaction,
                    "❌ Ce giveaway est terminé."
                );
            }

            if (giveaway.entrants.has(interaction.user.id)) {
                return replyPrivate(
                    interaction,
                    "⚠️ Tu participes déjà à ce giveaway."
                );
            }

            giveaway.entrants.add(interaction.user.id);

            return replyPrivate(
                interaction,
                "🎉 Tu participes maintenant au giveaway !"
            );
        }

        // ==================================================
        // VÉRIFICATION DES MEMBRES
        // ==================================================

        if (
            interaction.isButton() &&
            interaction.customId === "verify_member"
        ) {
            const config = getConfig(interaction.guild.id);
            const roleId = config.verifiedRole;

            if (!roleId) {
                return replyPrivate(
                    interaction,
                    "❌ Aucun rôle configuré. Demande au staff d'utiliser `+setverified @role`."
                );
            }

            const role = interaction.guild.roles.cache.get(roleId);

            if (!role) {
                return replyPrivate(
                    interaction,
                    "❌ Le rôle configuré n'existe plus."
                );
            }

            const member = await interaction.guild.members
                .fetch(interaction.user.id);

            if (member.roles.cache.has(role.id)) {
                return replyPrivate(
                    interaction,
                    "✅ Tu es déjà vérifié."
                );
            }

            await member.roles.add(role);

            return replyPrivate(
                interaction,
                "✅ Vérification réussie !"
            );
        }

    } catch (error) {
        console.error("Erreur interaction :", error);

        if (interaction.isRepliable()) {
            await replyPrivate(
                interaction,
                "❌ Une erreur est survenue pendant cette action."
            ).catch(() => {});
        }
    }
});

        // ==================================================
        // ANTI-NUKE : ALERTES UNIQUEMENT
        // ==================================================

        client.on("channelDelete", async channel => {
            if (!channel.guild) return;

            const config = getConfig(channel.guild.id);
            if (!config.antiNuke) return;

            await sendLog(
                channel.guild,
                `🚨 **ALERTE ANTI-NUKE**\nUn salon vient d'être supprimé : **${channel.name}**. Vérifie les journaux d'audit du serveur.`
            );
        });

        client.on("roleDelete", async role => {
            const config = getConfig(role.guild.id);
            if (!config.antiNuke) return;

            await sendLog(
                role.guild,
                `🚨 **ALERTE ANTI-NUKE**\nLe rôle **${role.name}** vient d'être supprimé.`
            );
        });

        client.on("guildBanAdd", async ban => {
            const config = getConfig(ban.guild.id);
            if (!config.antiNuke) return;

            await sendLog(
                ban.guild,
                `🚨 **ALERTE ANTI-NUKE**\nLe membre **${ban.user.tag}** vient d'être banni.`
            );
        });

        client.on("guildUpdate", async (oldGuild, newGuild) => {
            const config = getConfig(newGuild.id);
            if (!config.antiNuke) return;

            if (oldGuild.name !== newGuild.name) {
                await sendLog(
                    newGuild,
                    `🚨 **ALERTE ANTI-NUKE**\nNom du serveur modifié : **${oldGuild.name}** → **${newGuild.name}**.`
                );
            }

            if (oldGuild.icon !== newGuild.icon) {
                await sendLog(
                    newGuild,
                    "🚨 **ALERTE ANTI-NUKE**\nL'icône du serveur a été modifiée."
                );
            }
        });

// ======================================================
// CONNEXION
// ======================================================

if (!process.env.DISCORD_TOKEN) {
    console.error("❌ Le TOKEN est absent du fichier .env");
    process.exit(1);
}

client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.error("❌ Connexion Discord impossible :", error);
});
