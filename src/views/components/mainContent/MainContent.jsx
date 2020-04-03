import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import Grid from "@material-ui/core/Grid";
import {makeStyles} from "@material-ui/core/styles";
import Box from '@material-ui/core/Box';
import RoomsList from "../roomsList";
import Chat from "./chat";
import Button from "@material-ui/core/Button";
import shortHash from 'short-hash';
import {connect} from "react-redux";
import {reset} from 'redux-form';
import {createRoom, leaveRoom, saveMessage} from "../../../state/chat";
import {useParams} from "react-router-dom";
import {useHistory} from "react-router-dom";
import {findRoom} from "../../../utils/findRoom";
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
import {sendMessage} from "../../../state/chat/operations";
import {debounce} from 'lodash';

const useStyle = makeStyles({
    root: {
        minHeight: 'calc(100vh - 64px)',
    },
    head: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 32px',
        borderBottom: '1px solid #CCC',
        borderRight: '1px solid #CCC',
        '&:first-child': {
            borderLeft: '1px solid #CCC'
        }
    },
    leaveRoom: {
        cursor: 'pointer',
    },
    chatWrapper: {
        minHeight: 'calc(100vh - 134px)',
    },
    roomsList: {
        borderRight: '1px solid #CCC',
        borderLeft: '1px solid #CCC',
        padding: '16px 32px',
    },
    chatWindow: {
        borderRight: '1px solid #CCC',
    },
    createRoomBtn: {
        background: '#CACACA'
    }
});

const MainContent = ({
                         socket,
                         createRoom,
                         rooms,
                         isJoined,
                         user,
                         leaveRoom,
                         resetForm,
                         sendMessage,
                         saveMessage
                     }) => {
    const styles = useStyle();

    const [showAlert, setShowAlert] = useState(false);
    const [joinedUserName, setJoinedUserName] = useState(null);
    const [usersOnline, setUsersOnline] = useState([]);
    const [typing, setTyping] = useState(false);
    const [typingUsers, setTypingUsers] = useState([]);

    let {id} = useParams();

    const history = useHistory();

    const roomId = useRef(id);

    useEffect(() => {
        socket.on('room', room => {
            createRoom(room);
        });
    }, []);

    useEffect(
        () => {
            roomId.current = id
        },
        [id]
    );


    //уведомление о зашедшем пользователе
    useEffect(() => {
        socket.on('user_join_room', data => {
            if (roomId.current === data.room.hash) {
                setJoinedUserName(data.user.name);
                setShowAlert(true);
            }
        });
    }, []);

    //Юзер зашел в комнату по ссылке
    useEffect(() => {
        if (id) {
            //если комнаты нет в списке - добавляем
            if (!findRoom(id, rooms)) {
                socket.emit('get_room', id);
            }

            socket.emit('join_room', {user, room: {hash: id}});
        }
    }, []);

    useEffect(() => {
        socket.emit('get_users_in_room', {id});
    }, [id]);

    useEffect(() => {
        socket.on('message', message => {
            console.log(message);
            saveMessage(message);
        });
    }, []);

    useEffect(() => {
        socket.on('users_in_room', data => {
            if (data.hash === roomId.current) {
                setUsersOnline(data.users);
            }
        });
    }, []);

    useLayoutEffect (() => {
        socket.on('typing_on', ({user, hash}) => {
           if (hash === roomId.current) {
                setTypingUsers([...typingUsers, {name: user.name}]);
            }
        });
    }, []);

    useEffect(() => {
        socket.on('typing_off', ({user, hash}) => {
            if (hash === roomId.current) {
                setTypingUsers(typingUsers.filter(u => u.id !== user.id));
            }
        });
    }, []);

    const handleCreateRoom = () => {
        socket.emit('create_room', {user})
    };

    const handleSubmit = ({message}) => {
        if(message){
            socket.emit('send_message', {message, roomId: id});
            sendMessage({text: message, date: Date.now(), roomId: id, author: 'Я', icon: user.icon, isMyMessage: true});
            resetForm();
        }
    };

    const handleLeaveRoom = () => {
        socket.emit('leave_room', id);
        resetForm();
        leaveRoom(id);
        history.push({
            pathname: "/"
        });
    };

    const typingStart = () => {
        socket.emit('start_typing', {user, roomId: id});
    };

    const typingStop = debounce(() => {
        socket.emit('stop_typing', {user, roomId: id});
        setTyping(false);
    }, 1500);

    const handleTyping = () => {
        if (!typing) {
            typingStart();
            setTyping(true);
            typingStop();
        }

    };

    const currentRoom = rooms.find(r => r.hash === id);

    const roomName = currentRoom ? currentRoom.name : 'комната';

    const messages = currentRoom ? currentRoom.messages : [];

    return (
        <Box className={styles.root} display="flex" flexDirection='column' justifyContent='space-between'>

            <Box>
                <Grid container justify='space-between'>
                    <Grid
                        container
                        justify='space-between'
                        className={styles.head}
                        item
                        xs={3}
                    >
                        <Grid item>
                            Комнаты
                        </Grid>
                        <Grid item>
                            <Button
                                className={styles.createRoomBtn}
                                variant="contained"
                                onClick={handleCreateRoom}
                            >
                                Создать
                            </Button>
                        </Grid>
                    </Grid>
                    <Grid
                        className={styles.head}
                        item
                        xs={9}>
                        {isJoined && (
                            <>
                                <Button style={{background: roomName, color: '#FFF'}}>{roomName}</Button>
                                {usersOnline && usersOnline.map(u => <span>{u.name}</span>)}
                                <ExitToAppIcon className={styles.leaveRoom} onClick={handleLeaveRoom}/>
                            </>
                        )}
                    </Grid>
                </Grid>
            </Box>

            <Box flexGrow={1}>
                <Grid className={styles.chatWrapper} container>
                    <Grid
                        className={styles.roomsList}
                        item
                        xs={3}>
                        <RoomsList rooms={rooms}/>
                    </Grid>
                    <Grid
                        className={styles.chatWindow}
                        item xs={9}>
                        {isJoined && (
                            <Chat
                                handleSubmit={handleSubmit}
                                onChange={handleTyping}
                                showAlert={showAlert}
                                joinedUserName={joinedUserName}
                                messages={messages}
                                typingUsers={typingUsers}
                                /*messages={[{author: 'Жанна', date: 12315464545, text: 'lorem sdfsfg sfg adsad asdadsf s sfg ad SFG A ADF ASG ASD SDFDf r wef wef q q' }]}*/
                            />
                        )}
                    </Grid>
                </Grid>
            </Box>

        </Box>
    );
};

const mapStateToProps = state => ({
    rooms: state.chat.rooms,
    user: state.chat.user
});

function mapDispatchToProps(dispatch) {
    return {
        createRoom: (room) => dispatch(createRoom(room)),
        leaveRoom: (id) => dispatch(leaveRoom(id)),
        resetForm: () => dispatch(reset('messageForm')),
        saveMessage: (message) => dispatch(saveMessage(message)),
        sendMessage: (message) => dispatch(sendMessage(message))
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(MainContent);