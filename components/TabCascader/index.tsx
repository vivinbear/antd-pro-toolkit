import React, { Component, UIEventHandler } from 'react';
import _ from 'lodash';
import debounce from 'lodash/debounce';
import classNames from 'classnames';
import { Tabs, Input, Row, Col, Spin, Empty } from 'antd';
import OptionList, { RefOptionListProps } from './OptionList';
import { Omit } from '../_util/type';
import { isArrayEqual } from '../_util/tools';
import { InputProps } from 'antd/lib/input';
import KeyCode from 'rc-util/lib/KeyCode';

import './style';

const TabPane = Tabs.TabPane

export interface Result {
  errorCode?: number;
  data?: any;
  msg?: string;
}

export interface PanelData {
  title: string;
  code: string;
  maxLevel: number;
  items: Array<TabData>
}

export interface TabData {
  title: string;
  level: number;
  entry: boolean;
  items: Array<Item>;
}

export interface Pagination {
  currentPage: number;
  currentResult: number;
  pageSize: number;
  totalPage: number;
  totalResult: number;
}

export interface TabInputProps extends Omit<InputProps, 'onBlur' | 'onClick' | 'onChange'> {
  renderValue?: (selectedItems: Array<Item>) => string;
}

export interface CascaderProps {
  value?: Array<Item>;
  dataSource: Array<PanelData>;
  prefixCls?: string;
  className?: string;
  hint?: string | React.ReactNode;
  style?: React.CSSProperties;
  contentStyle?: React.CSSProperties;
  contentCls?: string;
  colSpan?: number;
  inputProps?: TabInputProps;
  pagination?: Boolean | Pagination;
  listHeight?: number;
  listItemHeight?: number;
  onItemClick?: (key: number, topKey: number, item: Item, ) => Promise<any>;
  onSearchItemClick?: (item: Item, ) => Promise<any>;
  onTopTabChange?: (topKey: number) => void;
  onTabChange?: (key: number, topKey: number, item: Item | undefined) => Promise<Result>;
  onSearch?: (params: any) => Promise<any>;
  onBlur?: React.FocusEventHandler<Element>;
  onChange?: Function;
  onClear?: Function;
  onPopupScroll?: UIEventHandler<HTMLDivElement>;
}

export interface Item {
  code: string;
  name: string;
  level: number;
  groupCode: string;
  parentCode?: string;
  parents: Array<Item>;
  [key: string]: any;
}

export interface CascaderState {
  firstTab: number;
  secondTab: number;
  inputVal: string;
  selectedItems: Array<Item>;
  visible: Boolean;
  searchVisible: Boolean;
  tabLoading: Boolean;
  isSearching: Boolean;
  fetchList: Array<any>;
  pagination?: Pagination;
}

export default class TabCascader extends Component<CascaderProps, CascaderState> {
  el: HTMLDivElement | null;
  debounceSearch: Function;
  listRef: React.RefObject<RefOptionListProps>;

  static defaultProps = {
    prefixCls: 'ant-tab-cascader',
    colSpan: 6,
  }

  constructor(props: CascaderProps) {
    super(props);
    this.state = {
      firstTab: 0,
      secondTab: 0,
      inputVal: '',
      selectedItems: [],
      visible: false,
      searchVisible: false,
      tabLoading: false,
      isSearching: false,
      fetchList: []
    };
    this.debounceSearch = debounce(this.handleSearch, 600);
    this.listRef = React.createRef();
  }

  componentDidMount() {
    document.addEventListener('click', this.handleOutsideClick, false);
    this.initPagination();
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.handleOutsideClick, false);
  }

  componentWillReceiveProps(nextProps: CascaderProps) {
    const { value, dataSource } = this.props;
    let dataSourceCondition = nextProps.dataSource && nextProps.dataSource.length > 0;
    let hasValChange = !isArrayEqual(nextProps.value, value);
    let hasDataSourceChange = !isArrayEqual(nextProps.dataSource, dataSource);
    if (nextProps.value && !_.isEmpty(nextProps.value) && dataSourceCondition && (hasValChange || hasDataSourceChange)) {
      this.setState({
        selectedItems: nextProps.value,
        inputVal: this.renderValue(nextProps.value)
      });
      this.setInitialValue(nextProps.dataSource, nextProps.value);
    }
    if (!nextProps.value && value && nextProps.dataSource && nextProps.dataSource.length > 0) {
      this.setState({
        selectedItems: [],
        inputVal: '',
        firstTab: 0,
        secondTab: 0
      });
    }
  }

  renderValue = (items: Array<Item>): string => {
    const { inputProps } = this.props;
    if (!inputProps || !inputProps.renderValue) {
      return items.map(i => i.name).join('-');
    } else {
      return inputProps.renderValue(items);
    }
  }

  initPagination = () => {
    const { pagination } = this.props;
    if (pagination) {
      let initPagination = {
        currentPage: 1,
        currentResult: 0,
        pageSize: 10,
        totalPage: 0,
        totalResult: 0
      };
      if (typeof pagination == 'boolean') {
        this.setState({
          pagination: initPagination
        })
      } else if (typeof pagination == 'object') {
        this.setState({ pagination: Object.assign(initPagination, pagination) });
      }
    }
  }

  setInitialValue = (dataSource: Array<PanelData>, value: Array<Item>) => {
    let groupCode = value[0].groupCode;
    let panelIdx = dataSource.findIndex((data: PanelData) => data.code == groupCode);
    if (panelIdx == -1) {
      throw new Error(`value does't in the top datas.`);
    }
    let panelData = dataSource[panelIdx];
    let maxLevel = panelData.maxLevel;
    let lastItem = value[value.length - 1];
    if (panelData && panelData.items.length > 0) {
      for (let i = 0; i < panelData.items.length; i++) {
        let targetLevel = lastItem.level == maxLevel ? maxLevel : lastItem.level + 1;
        if (panelData.items[i].entry && panelData.items[i].level == targetLevel) {
          this.setState({ firstTab: panelIdx, secondTab: i });
          break;
        }
      }
    }
  }

  handleOutsideClick = (e: MouseEvent) => {
    const { selectedItems } = this.state;
    const el = this.el as HTMLDivElement;
    e.stopPropagation();
    const target = e.target as Node;
    if (!document.contains(target)) {
      return;
    }
    if (!el.contains(target)) {
      this.setState({
        visible: false,
        searchVisible: false,
        inputVal: this.renderValue(selectedItems)
      });
    }
  }

  handleTopTabChange = (tabKey: string) => {
    const { onTopTabChange } = this.props;
    let numKey = Number(tabKey);
    this.setState({ secondTab: 0, firstTab: numKey });
    if (onTopTabChange) {
      onTopTabChange(numKey);
    }
  };

  handleSecondTabChange = (tabKey: string) => {
    const { onTabChange, dataSource } = this.props;
    const { firstTab, selectedItems } = this.state;

    let currentKey = Number(tabKey);
    let currentTabData = dataSource[firstTab].items[currentKey];

    if (currentTabData && currentTabData.items.length > 0) {
      this.setState({ secondTab: currentKey });
    } else {
      if (onTabChange) {
        this.setState({ tabLoading: true });
        let currentItem = selectedItems.find(item => item.level === currentTabData.level);
        onTabChange(currentKey, firstTab, currentItem).then(() => {
          this.setState({ tabLoading: false });
          this.setState({ secondTab: currentKey });
        })
      }
    }

  };


  handleClickItem = (item: Item) => {
    const { onChange, onItemClick, dataSource } = this.props;
    let { selectedItems, firstTab, secondTab } = this.state;

    if (selectedItems.length == 0) {
      selectedItems.push(item);
    } else {
      // 换组选择了
      if (selectedItems[0].groupCode !== item.groupCode) {
        selectedItems = [item];
      } else {
        let parentIdx = 0;
        let hasParent = selectedItems.some((sItem, sIdx) => {
          if (sItem.code == item.parentCode) {
            parentIdx = sIdx;
          }
          return sItem.code == item.parentCode;
        });

        if (!hasParent) {
          selectedItems = [item];
        } else {
          selectedItems = selectedItems.slice(0, parentIdx + 1);
          selectedItems.push(item);
        }
      }
    }
    const displayVal = this.renderValue(selectedItems);
    this.setState({ selectedItems, inputVal: displayVal });

    if (dataSource[firstTab].maxLevel == item.level) {
      this.setState({ visible: false });
    }
    // 异步加载下一级项数据
    if (onItemClick) {
      if (item.level !== dataSource[firstTab].maxLevel) {
        if (secondTab == 0 && firstTab == 0) {
          this.setState({ secondTab: secondTab + 2, tabLoading: true });
        } else {
          this.setState({ secondTab: secondTab + 1, tabLoading: true });
        }
      }
      onItemClick(secondTab, firstTab, item).then(() => {
        this.setState({ tabLoading: false });
        if (onChange) {
          onChange(selectedItems);
        }
      })
    } else { // 静态数据
      let nextTabData = dataSource[firstTab].items[secondTab + 1];
      if (nextTabData && nextTabData.items.length > 0) {
        this.setState({ secondTab: secondTab + 1 });
      }
    }
  };

  handleSearchItemClick = async (item: Item) => {
    const { dataSource, onSearchItemClick, onChange } = this.props;
    let { firstTab, selectedItems } = this.state;

    firstTab = Number(item.groupCode);
    selectedItems = [];
    let itemList = [...(item.parents ? item.parents : []), item];
    let startLevel = firstTab == 0 ? 2 : 1;
    selectedItems = itemList.filter(nItem => nItem.level >= startLevel);
    const displayVal = this.renderValue(selectedItems);
    this.setState({
      firstTab,
      searchVisible: false,
      visible: true,
      selectedItems,
      inputVal: displayVal
    });
    if (onChange) {
      onChange(selectedItems);
    }
    if (item.level == dataSource[firstTab].maxLevel) {
      this.setState({
        visible: false
      });
    } else {
      if (onSearchItemClick) {
        this.setState({ tabLoading: true });
        onSearchItemClick(item).then(() => {
          this.setState({
            tabLoading: false
          });
        });
      }
    }
  }

  hanldeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { onClear, onChange } = this.props;

    let inputVal = e.target.value;
    this.setState({ inputVal });
    if (!inputVal) {
      this.setState({
        visible: false,
        searchVisible: false
      });
      // click the clear icon
      if (e.type == 'click') {
        this.setState({
          selectedItems: [],
          firstTab: 0,
          secondTab: 0
        });
        if (onChange) {
          onChange([]);
        }
        if (onClear) {
          onClear(e);
        }
      }
      return;
    }
    this.setState({ isSearching: true, visible: false, searchVisible: true });
    this.debounceSearch(inputVal);

  }

  handleSearch = (val: string) => {
    const { onSearch } = this.props;
    const { searchVisible, pagination } = this.state;

    if (onSearch && searchVisible) {
      this.setState({ isSearching: true, visible: false, searchVisible: true });
      let query: any = { content: val };
      if (pagination) {
        query.pageSize = pagination.pageSize;
      }
      onSearch(query).then(res => {
        this.setState({
          fetchList: res.data || [],
          pagination: res.pagination,
          isSearching: false
        });
      });
    }
  }

  handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    (e.target as HTMLInputElement).select();
    this.setState({ visible: true });
  }

  handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { searchVisible } = this.state;
    const { onBlur } = this.props;
    const el = this.el as HTMLDivElement;
    const target = e.target as Node;
    this.setState({ searchVisible: false });
    if (searchVisible && !el.contains(target)) {
      this.setState({
        selectedItems: [],
        inputVal: ''
      });
    }
    if (onBlur) {
      onBlur(e);
    }
  }

  handleSearchScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { onPopupScroll, onSearch } = this.props;
    const { fetchList, pagination, inputVal } = this.state;
    const target = e.target as HTMLDivElement;
    const { scrollTop, scrollHeight, clientHeight } = target;
    if (!pagination) return;
    if (onPopupScroll) {
      onPopupScroll(e);
    }
    if (scrollTop + clientHeight == scrollHeight && fetchList.length < pagination.totalResult) {
      if (onSearch) {
        onSearch({
          content: inputVal,
          pageIndex: pagination.currentPage + 1,
          pageSize: pagination.pageSize,
        }).then(res => {
          if (res.errorCode === 0) {
            this.setState({
              fetchList: [...fetchList].concat(res.data),
              pagination: res.pagination
            });
          }
        });
      }
    }
  }

  onToggleDropdown = (flag: boolean = false) => {
    this.setState({
      searchVisible: flag
    });
  }

  handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const { selectedItems } = this.state;
    const { which } = e;

    if (which === KeyCode.ESC) {
      this.onToggleDropdown();
      this.setState({
        inputVal: this.renderValue(selectedItems)
      });
      return;
    }

    if (which === KeyCode.UP || which === KeyCode.DOWN) {
      e.preventDefault();
    }

    if (this.listRef.current) {
      this.listRef.current.onKeyDown(e);
    }
  }

  renderItems = (tabItem: TabData) => {
    const items = tabItem.items;
    const { colSpan, prefixCls } = this.props;
    const { selectedItems } = this.state;

    const hasSelectedItem = (item: Item) => {
      return selectedItems.findIndex(sItem => item.code == sItem.code) > -1 && tabItem.entry;
    }

    const itemList = items.map((item: Item) => (
      <Col xs={12} md={colSpan} key={item.code}>
        <li
          className={classNames({
            'tab-item-selected': hasSelectedItem(item)
          })}
          onClick={() => this.handleClickItem(item)}
        >
          <a>{item.name}</a>
        </li>
      </Col>
    ))

    return (
      <div className={`${prefixCls}-tab-items`}>
        <ul className={`${prefixCls}-panel-list`}>
          <Row>
            {
              items.length === 0
                ? <Empty className="empty" />
                : itemList
            }
          </Row>
        </ul>
      </div>
    )
  }

  renderContent = () => {
    const { prefixCls, dataSource, hint, contentCls, contentStyle } = this.props;
    const { visible, firstTab, secondTab, tabLoading } = this.state;

    const contentClassName = classNames(
      `${prefixCls}-content-wrap`,
      contentCls,
      {
        'antd-pro-hidden': !visible
      }
    );

    return (
      <div className={contentClassName} style={contentStyle}>
        <div className="hint">{hint}</div>
        <Tabs
          animated={false}
          className={`${prefixCls}-top-tab`}
          activeKey={`${firstTab}`}
          onChange={this.handleTopTabChange}
        >
          {
            dataSource.map((item: PanelData, panelIdx: number) => (
              <TabPane key={`${panelIdx}`} tab={item.title}>
                <Tabs
                  animated={false}
                  className={`${prefixCls}-second-tab`}
                  activeKey={`${secondTab}`}
                  onChange={this.handleSecondTabChange}
                >
                  {
                    item.items.map((tabItem: TabData, tabIdx: number) => (
                      <TabPane
                        key={`${tabIdx}`}
                        className={`${prefixCls}-tab-panel`}
                        tab={
                          <li className={classNames({ 'tab-header-dot': tabItem.entry })}>
                            {tabItem.title}
                          </li>
                        }
                      >
                        {tabLoading && tabIdx === secondTab ? <div className="tab-loading"><Spin /></div> : this.renderItems(tabItem)}
                      </TabPane>
                    ))
                  }
                </Tabs>
              </TabPane>
            ))
          }
        </Tabs>
      </div>
    );
  };

  renderSearchSection() {
    const {
      contentCls,
      contentStyle,
      prefixCls,
      listHeight = 200,
      listItemHeight = 40
    } = this.props;
    const { fetchList, isSearching, searchVisible } = this.state;

    const cls = classNames('search-section', contentCls, {
      'antd-pro-hidden': !searchVisible
    });
    return (
      <div className={cls} style={contentStyle} onScroll={this.handleSearchScroll}>
        {
          isSearching
            ? <Spin className="loading-spin" />
            : <OptionList
              itemKey="code"
              prefixCls={prefixCls}
              ref={this.listRef}
              height={listHeight}
              itemHeight={listItemHeight}
              data={fetchList}
              onSelect={this.handleSearchItemClick}
              notFoundContent={<Empty className="empty" />}
            />
        }
      </div>
    )
  }

  render() {
    const { inputVal } = this.state;
    const { className, style, inputProps, prefixCls } = this.props;

    const cascaderCls = classNames(prefixCls, className);
    const inputClassName = classNames(
      `${prefixCls}-search-bar`,
      inputProps ? inputProps.className : '',
      {
        [`${prefixCls}-search-suffix`]: inputProps && inputProps.allowClear && inputProps.addonAfter
      }
    );

    return (
      <div
        ref={node => this.el = node}
        className={cascaderCls}
        style={style}
      >
        <Input
          {..._.omit(inputProps, ['renderValue'])}
          className={inputClassName}
          value={inputVal}
          onChange={this.hanldeInputChange}
          onKeyDown={this.handleKeyDown}
          onClick={this.handleInputClick}
          onBlur={this.handleInputBlur}
        ></Input>
        {this.renderContent()}
        {this.renderSearchSection()}
      </div>
    );
  }
}
